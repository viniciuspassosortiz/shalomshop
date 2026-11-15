# ShalomShop — loja online de variedades

Vitrine para o cliente (`/`) e painel do dono (`/admin`). Next.js 14 + Supabase, hospedagem na Netlify.
Projeto **separado** de outras lojas: repositório, banco e site próprios.

## O que tem
- Vitrine com categorias, busca e estoque (“esgotado”, “últimas unidades”).
- Carrinho (guardado no aparelho), retirada ou entrega (taxa fixa e pedido mínimo configuráveis).
- Pedido gravado no banco; preço e estoque são conferidos **no banco**, não no navegador.
- Depois do pedido, botão que abre o WhatsApp da loja com a mensagem pronta. O pagamento é combinado ali (sem cobrança online).
- Painel: pedidos (confirmar → pronto → entregue, marcar pago, cancelar devolve o estoque, WhatsApp do cliente),
  produtos (foto, preço, estoque, categoria, esconder/mostrar), faturamento e configurações (WhatsApp, entrega, pedido mínimo, pausar pedidos).
- Sem as variáveis do Supabase o site abre em **modo demonstração** (produtos de exemplo, nenhum pedido é enviado).

## Colocar no ar (uma vez)
1. **Supabase**: criar um projeto novo (só da ShalomShop).
2. **SQL Editor**: colar e rodar `supabase/migrations/001_loja.sql`.
3. **Authentication → Users → Add user**: criar o login do dono (e-mail + senha).
4. **SQL Editor**: `insert into public.owners(email) values ('email-do-dono@exemplo.com');` (o mesmo e-mail do passo 3).
5. **Authentication → Sign In / Providers → Email**: desligar “Allow new users to sign up” (só o dono entra).
6. **Netlify**: novo site a partir deste repositório; em *Environment variables* cadastrar
   `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase → Project Settings → API).
7. Abrir `/admin`, entrar, cadastrar o **WhatsApp da loja** na aba *Loja* e os produtos na aba *Produtos*.

## Rodar no computador
```
cp .env.example .env.local   # preencher as duas variáveis
npm install
npm run dev
```

## Segurança (resumo)
- O visitante só consegue **ler produtos ativos** e **criar pedidos** (função `create_order`). Não lê pedidos, nem e-mails do dono.
- Alterar status/pagamento de pedido só pela função do dono (`set_order_status`, `set_order_paid`).
- Fotos: leitura pública; envio/troca/exclusão só do dono.

## Publicação
Site na Netlify, ligado a este repositório: cada commit na `main` publica de novo.
