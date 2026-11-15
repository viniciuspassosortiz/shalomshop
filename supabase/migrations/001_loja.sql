-- ShalomShop: loja online de variedades (vitrine + pedidos + painel do dono). Sem pagamento online:
-- o pedido vai para o WhatsApp da loja e o pagamento é combinado lá.
-- Rodar UMA vez no SQL Editor do projeto Supabase da ShalomShop.
-- DEPOIS de rodar, cadastre o e-mail do dono (o mesmo que ele usa para entrar no painel):
--   insert into public.owners(email) values ('email-do-dono@exemplo.com');

-- ---------------------------------------------------------------- dono
create table if not exists public.owners (email text primary key);
alter table public.owners enable row level security;      -- sem policy: ninguém lê pela API
revoke all on public.owners from anon, authenticated;

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.owners o
    where lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated;

-- ---------------------------------------------------------------- configurações da loja (1 linha)
create table if not exists public.shop_settings (
  id boolean primary key default true check (id),
  whatsapp text not null default '',
  delivery_enabled boolean not null default true,
  delivery_fee numeric(10,2) not null default 0 check (delivery_fee >= 0),
  min_order numeric(10,2) not null default 0 check (min_order >= 0),
  store_open boolean not null default true
);
insert into public.shop_settings (id) values (true) on conflict do nothing;
alter table public.shop_settings enable row level security;
drop policy if exists "publico le configuracoes" on public.shop_settings;
create policy "publico le configuracoes" on public.shop_settings for select to anon, authenticated using (true);
drop policy if exists "admin altera configuracoes" on public.shop_settings;
create policy "admin altera configuracoes" on public.shop_settings for update to authenticated using (public.is_owner()) with check (public.is_owner());
revoke all on public.shop_settings from anon;
grant select on public.shop_settings to anon;
grant select, update on public.shop_settings to authenticated;

-- ---------------------------------------------------------------- produtos
create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 120),
  description text check (description is null or length(description) <= 500),
  category text not null default 'Outros' check (length(category) between 1 and 40),
  price numeric(10,2) not null check (price >= 0),
  stock int check (stock is null or stock >= 0),    -- vazio = não controla estoque
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists products_active_idx on public.products (active, category, name);
alter table public.products enable row level security;
drop policy if exists "publico le produtos ativos" on public.products;
create policy "publico le produtos ativos" on public.products for select to anon using (active);
drop policy if exists "logado le produtos" on public.products;
create policy "logado le produtos" on public.products for select to authenticated using (active or public.is_owner());
drop policy if exists "admin gerencia produtos" on public.products;
create policy "admin gerencia produtos" on public.products for all to authenticated using (public.is_owner()) with check (public.is_owner());
revoke all on public.products from anon;
grant select on public.products to anon;
grant select, insert, update, delete on public.products to authenticated;

-- ---------------------------------------------------------------- pedidos
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_name text not null,
  customer_phone text not null,
  delivery_type text not null check (delivery_type in ('retirada','entrega')),
  address text,
  notes text,
  subtotal numeric(10,2) not null,
  delivery_fee numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  status text not null default 'novo' check (status in ('novo','confirmado','pronto','entregue','cancelado')),
  paid boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  product_name text not null,
  unit_price numeric(10,2) not null,
  quantity int not null check (quantity between 1 and 20)
);
create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.orders enable row level security;
alter table public.order_items enable row level security;
revoke all on public.orders, public.order_items from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;   -- o dono só LÊ; alterações vão pelas funções abaixo
drop policy if exists "admin le pedidos" on public.orders;
create policy "admin le pedidos" on public.orders for select to authenticated using (public.is_owner());
drop policy if exists "admin le itens" on public.order_items;
create policy "admin le itens" on public.order_items for select to authenticated using (public.is_owner());

-- ---------------------------------------------------------------- criar pedido (o cliente chama; preço e estoque são conferidos aqui)
create or replace function public.create_order(
  p_name text, p_phone text, p_delivery text, p_address text, p_notes text, p_items jsonb
)
returns table(order_code text, order_total numeric)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set public.shop_settings%rowtype;
  v_phone text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_name text := btrim(coalesce(p_name, ''));
  v_addr text := nullif(btrim(coalesce(p_address, '')), '');
  v_notes text := nullif(btrim(coalesce(p_notes, '')), '');
  v_subtotal numeric(10,2) := 0;
  v_fee numeric(10,2) := 0;
  v_id uuid;
  v_code text;
  v_item record;
  v_p public.products%rowtype;
  v_n int;
begin
  select * into v_set from public.shop_settings where id;
  if not v_set.store_open then
    raise exception 'A loja não está aceitando pedidos agora. Tente mais tarde.';
  end if;

  if length(v_name) < 2 or length(v_name) > 80 then
    raise exception 'Informe seu nome.';
  end if;
  if length(v_phone) < 10 or length(v_phone) > 13 then
    raise exception 'Informe um telefone válido com DDD.';
  end if;
  if p_delivery not in ('retirada','entrega') then
    raise exception 'Escolha retirada ou entrega.';
  end if;
  if p_delivery = 'entrega' then
    if not v_set.delivery_enabled then raise exception 'A loja não está fazendo entregas agora.'; end if;
    if v_addr is null or length(v_addr) < 8 then raise exception 'Informe o endereço de entrega.'; end if;
    v_fee := v_set.delivery_fee;
  else
    v_addr := null;
  end if;
  if length(coalesce(v_addr, '')) > 200 or length(coalesce(v_notes, '')) > 300 then
    raise exception 'Texto muito longo.';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 40 then
    raise exception 'Seu carrinho está vazio.';
  end if;

  -- limite simples contra abuso: no máximo 5 pedidos novos por telefone
  select count(*) into v_n from public.orders where customer_phone = v_phone and status = 'novo';
  if v_n >= 5 then
    raise exception 'Esse telefone já tem pedidos aguardando confirmação. Aguarde o contato da loja.';
  end if;

  -- código curto, único
  loop
    v_code := 'SS-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 5));
    exit when not exists (select 1 from public.orders where code = v_code);
  end loop;

  insert into public.orders (code, customer_name, customer_phone, delivery_type, address, notes, subtotal, delivery_fee, total)
  values (v_code, v_name, v_phone, p_delivery, v_addr, v_notes, 0, v_fee, 0)
  returning id into v_id;

  -- junta linhas repetidas e trava os produtos em ordem fixa (evita venda dupla do mesmo estoque)
  for v_item in
    select (e ->> 'id')::uuid as pid, sum(least(greatest((e ->> 'qty')::int, 0), 1000))::int as qty
    from jsonb_array_elements(p_items) e
    group by 1
    order by 1
  loop
    if v_item.qty < 1 or v_item.qty > 20 then
      raise exception 'Quantidade inválida.';
    end if;
    select * into v_p from public.products where id = v_item.pid and active for update;
    if not found then
      raise exception 'Um dos produtos não está mais disponível. Atualize a página.';
    end if;
    if v_p.stock is not null then
      if v_p.stock < v_item.qty then
        raise exception 'Estoque insuficiente de "%" (restam %).', v_p.name, v_p.stock;
      end if;
      update public.products set stock = stock - v_item.qty where id = v_p.id;
    end if;
    insert into public.order_items (order_id, product_id, product_name, unit_price, quantity)
    values (v_id, v_p.id, v_p.name, v_p.price, v_item.qty);
    v_subtotal := v_subtotal + v_p.price * v_item.qty;
  end loop;

  if v_subtotal < v_set.min_order then
    raise exception 'O pedido mínimo é de R$ %.', to_char(v_set.min_order, 'FM999990D00');
  end if;

  update public.orders set subtotal = v_subtotal, total = v_subtotal + v_fee where id = v_id;

  order_code := v_code;
  order_total := v_subtotal + v_fee;
  return next;
end;
$$;
revoke all on function public.create_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------- o dono muda status / pagamento
create or replace function public.set_order_status(p_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_owner() then raise exception 'Apenas o dono altera pedidos.'; end if;
  if p_status not in ('novo','confirmado','pronto','entregue','cancelado') then
    raise exception 'Status inválido.';
  end if;
  select status into v_old from public.orders where id = p_id for update;
  if not found then raise exception 'Pedido não encontrado.'; end if;
  if v_old = p_status then return; end if;

  -- cancelar devolve o estoque; reabrir um cancelado baixa de novo (se houver)
  if p_status = 'cancelado' then
    update public.products p set stock = p.stock + i.quantity
    from public.order_items i
    where i.order_id = p_id and i.product_id = p.id and p.stock is not null;
  elsif v_old = 'cancelado' then
    if exists (
      select 1 from public.order_items i join public.products p on p.id = i.product_id
      where i.order_id = p_id and p.stock is not null and p.stock < i.quantity
    ) then
      raise exception 'Sem estoque suficiente para reabrir este pedido.';
    end if;
    update public.products p set stock = p.stock - i.quantity
    from public.order_items i
    where i.order_id = p_id and i.product_id = p.id and p.stock is not null;
  end if;

  update public.orders set status = p_status where id = p_id;
end;
$$;
revoke all on function public.set_order_status(uuid, text) from public, anon;
grant execute on function public.set_order_status(uuid, text) to authenticated;

create or replace function public.set_order_paid(p_id uuid, p_paid boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_owner() then raise exception 'Apenas o dono altera pedidos.'; end if;
  update public.orders set paid = p_paid where id = p_id;
end;
$$;
revoke all on function public.set_order_paid(uuid, boolean) from public, anon;
grant execute on function public.set_order_paid(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------- fotos dos produtos
insert into storage.buckets (id, name, public) values ('produtos', 'produtos', true)
on conflict (id) do nothing;

drop policy if exists "produtos fotos leitura" on storage.objects;
create policy "produtos fotos leitura" on storage.objects for select using (bucket_id = 'produtos');
drop policy if exists "produtos fotos envio" on storage.objects;
create policy "produtos fotos envio" on storage.objects for insert to authenticated with check (bucket_id = 'produtos' and public.is_owner());
drop policy if exists "produtos fotos troca" on storage.objects;
create policy "produtos fotos troca" on storage.objects for update to authenticated using (bucket_id = 'produtos' and public.is_owner()) with check (bucket_id = 'produtos' and public.is_owner());
drop policy if exists "produtos fotos exclusao" on storage.objects;
create policy "produtos fotos exclusao" on storage.objects for delete to authenticated using (bucket_id = 'produtos' and public.is_owner());
