"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import Mark from "@/components/Mark";
import ProductArt from "@/components/ProductArt";
import { getSupabase } from "@/lib/supabase";
import { hasBackend } from "@/lib/data";
import { uploadProductPhoto } from "@/lib/image";
import { brl, fmtDateTime, maskPhone, onlyDigits } from "@/lib/format";
import { whatsappLink } from "@/lib/cart";
import { CATEGORIES } from "@/lib/types";
import type { Order, OrderStatus, Product, Settings } from "@/lib/types";

type Tab = "pedidos" | "faturamento" | "clientes" | "produtos" | "loja";

export default function Admin() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("pedidos");

  useEffect(() => {
    if (!hasBackend()) { setSession(null); return; }
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div className="wrap"><p className="empty">Carregando…</p></div>;
  if (!session) return <Login />;

  return (
    <div className="wrap adm">
      <div className="bar">
        <div className="row" style={{ gap: 8, flexWrap: "nowrap" }}><Mark size={34} /><h1>Painel</h1></div>
        <div className="row" style={{ flexWrap: "nowrap" }}>
          <a className="btn ghost sm" href="/" style={{ textDecoration: "none" }}>Ver loja</a>
          <button className="btn ghost sm" onClick={() => getSupabase().auth.signOut()}>Sair</button>
        </div>
      </div>
      <div className="tabs">
        {(["pedidos", "faturamento", "clientes", "produtos", "loja"] as Tab[]).map((t) => (
          <button key={t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "pedidos" ? "Pedidos" : t === "faturamento" ? "Faturamento" : t === "clientes" ? "Clientes" : t === "produtos" ? "Produtos" : "Loja"}
          </button>
        ))}
      </div>
      {tab === "pedidos" && <Orders />}
      {tab === "faturamento" && <Revenue />}
      {tab === "clientes" && <Clients />}
      {tab === "produtos" && <Products />}
      {tab === "loja" && <ShopSettings />}
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function go(e: React.FormEvent) {
    e.preventDefault();
    if (!hasBackend()) return setErr("O banco de dados ainda não foi conectado (variáveis do Supabase).");
    setBusy(true); setErr("");
    const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) setErr("E-mail ou senha incorretos.");
  }
  return (
    <div className="wrap" style={{ maxWidth: 420, paddingTop: 48 }}>
      <div style={{ textAlign: "center" }}><Mark size={84} /><h1 style={{ fontFamily: "var(--display)", fontWeight: 400, letterSpacing: ".06em", margin: "6px 0 18px" }}>PAINEL SHALOMSHOP</h1></div>
      <form className="card" onSubmit={go}>
        <label className="field"><span>E-mail</span><input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
        <label className="field"><span>Senha</span><input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {err && <p className="error">{err}</p>}
        <button className="btn block" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ pedidos */
const STATUS_LABEL: Record<OrderStatus, string> = { novo: "Novo", confirmado: "Confirmado", pronto: "Pronto", entregue: "Entregue", cancelado: "Cancelado" };
const FILTERS = [
  { id: "abertos", label: "Em aberto", test: (o: Order) => ["novo", "confirmado", "pronto"].includes(o.status) },
  { id: "entregues", label: "Entregues", test: (o: Order) => o.status === "entregue" },
  { id: "cancelados", label: "Cancelados", test: (o: Order) => o.status === "cancelado" },
  { id: "todos", label: "Todos", test: () => true },
];

function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("abertos");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(150);
    if (error) setErr("Não foi possível carregar os pedidos."); else { setErr(""); setOrders((data ?? []) as Order[]); }
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    const onVis = () => { if (document.visibilityState === "visible") load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", onVis); };
  }, [load]);

  async function setStatus(o: Order, status: OrderStatus) {
    if (status === "cancelado" && !window.confirm(`Cancelar o pedido ${o.code}? O estoque volta.`)) return;
    // Abre o WhatsApp do cliente já com a mensagem certa. Precisa ser feito logo no clique,
    // antes de qualquer await, senão o navegador bloqueia a janela.
    if (status === "pronto") {
      window.open(whatsappLink("55" + onlyDigits(o.customer_phone), msgFor({ ...o, status: "pronto" })), "_blank", "noopener");
    }
    setBusyId(o.id); setErr("");
    const { error } = await getSupabase().rpc("set_order_status", { p_id: o.id, p_status: status });
    if (error) setErr(error.message);
    await load(); setBusyId("");
  }
  async function setPaid(o: Order, paid: boolean) {
    setBusyId(o.id); setErr("");
    const { error } = await getSupabase().rpc("set_order_paid", { p_id: o.id, p_paid: paid });
    if (error) setErr(error.message);
    await load(); setBusyId("");
  }

  const f = FILTERS.find((x) => x.id === filter)!;
  const list = orders.filter(f.test);
  const counts = (id: string) => orders.filter(FILTERS.find((x) => x.id === id)!.test).length;

  function msgFor(o: Order) {
    const base = `Olá, ${o.customer_name.split(" ")[0]}! Aqui é da ShalomShop, sobre o pedido ${o.code} (${brl(o.total)}).`;
    if (o.status === "novo") return `${base} Recebemos seu pedido! Vamos combinar o pagamento e a entrega?`;
    if (o.status === "confirmado") return `${base} Pedido confirmado${o.paid ? "" : ". Falta só o pagamento"}.`;
    if (o.status === "pronto") return `${base} ${o.delivery_type === "entrega" ? "Estamos saindo para entregar." : "Seu pedido está pronto para retirada."}`;
    return base;
  }

  return (
    <>
      <div className="filters">
        {FILTERS.map((x) => (
          <button key={x.id} className={`chip ${filter === x.id ? "on" : ""}`} onClick={() => setFilter(x.id)}>{x.label} ({counts(x.id)})</button>
        ))}
      </div>
      {err && <p className="error">{err}</p>}
      {loading && <p className="empty">Carregando…</p>}
      {!loading && !list.length && <p className="empty">Nenhum pedido aqui.</p>}
      {list.map((o) => (
        <div className="card ord" key={o.id}>
          <div className="row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
            <div>
              <h3>{o.code} · {o.customer_name}</h3>
              <span className="muted" style={{ fontSize: 13 }}>{fmtDateTime(o.created_at)} · {maskPhone(o.customer_phone)}</span>
            </div>
            <div style={{ textAlign: "right" }}>
              <span className={`pill ${o.status}`}>{STATUS_LABEL[o.status]}</span>{" "}
              <span className={`pill ${o.paid ? "pago" : "naopago"}`}>{o.paid ? "Pago" : "A pagar"}</span>
            </div>
          </div>
          <ul>
            {(o.order_items ?? []).map((i) => <li key={i.id}>{i.quantity}x {i.product_name} — {brl(i.unit_price * i.quantity)}</li>)}
          </ul>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <b>{o.delivery_type === "entrega" ? `Entrega (+ ${brl(o.delivery_fee)})` : "Retirada"}</b>
            <b>Total {brl(o.total)}</b>
          </div>
          {o.address && <p className="muted" style={{ margin: "6px 0 0" }}>📍 {o.address}</p>}
          {o.notes && <p className="muted" style={{ margin: "6px 0 0" }}>📝 {o.notes}</p>}
          <div className="acts">
            {o.status === "novo" && <button className="btn sm" disabled={busyId === o.id} onClick={() => setStatus(o, "confirmado")}>Confirmar</button>}
            {o.status === "confirmado" && <button className="btn sm" disabled={busyId === o.id} onClick={() => setStatus(o, "pronto")}>{o.delivery_type === "entrega" ? "Saiu para entrega" : "Pronto p/ retirada"}</button>}
            {o.status === "pronto" && <button className="btn sm" disabled={busyId === o.id} onClick={() => setStatus(o, "entregue")}>Marcar entregue</button>}
            {o.status !== "cancelado" && <button className="btn ghost sm" disabled={busyId === o.id} onClick={() => setPaid(o, !o.paid)}>{o.paid ? "Desmarcar pago" : "Marcar como pago"}</button>}
            <a className="btn wa sm" style={{ textDecoration: "none" }} target="_blank" rel="noopener noreferrer" href={whatsappLink("55" + onlyDigits(o.customer_phone), msgFor(o))}>WhatsApp</a>
            {o.status !== "cancelado" && o.status !== "entregue" && <button className="btn ghost sm" disabled={busyId === o.id} onClick={() => setStatus(o, "cancelado")}>Cancelar</button>}
            {o.status === "cancelado" && <button className="btn ghost sm" disabled={busyId === o.id} onClick={() => setStatus(o, "novo")}>Reabrir</button>}
          </div>
        </div>
      ))}
    </>
  );
}

/* ----------------------------------------------------------------- produtos */
type Draft = { id?: string; name: string; description: string; category: string; price: string; stock: string; image_url: string | null; active: boolean };
const blank: Draft = { name: "", description: "", category: "Limpeza", price: "", stock: "", image_url: null, active: true };

function Products() {
  const [list, setList] = useState<Product[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase().from("products").select("*").order("category").order("name");
    if (error) setErr("Não foi possível carregar os produtos."); else setList((data ?? []).map((p) => ({ ...p, price: Number(p.price) })) as Product[]);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const edit = (p: Product) => setDraft({ id: p.id, name: p.name, description: p.description ?? "", category: p.category, price: String(p.price).replace(".", ","), stock: p.stock === null ? "" : String(p.stock), image_url: p.image_url, active: p.active });

  async function save() {
    if (!draft) return;
    const price = parseFloat(draft.price.replace(",", "."));
    const stock = draft.stock.trim() === "" ? null : parseInt(draft.stock, 10);
    if (draft.name.trim().length < 1) return setErr("Informe o nome do produto.");
    if (!Number.isFinite(price) || price < 0) return setErr("Informe um preço válido.");
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) return setErr("Estoque inválido (deixe vazio para não controlar).");
    setBusy(true); setErr("");
    const row = { name: draft.name.trim(), description: draft.description.trim() || null, category: draft.category.trim() || "Outros", price, stock, image_url: draft.image_url, active: draft.active };
    const sb = getSupabase();
    const { error } = draft.id ? await sb.from("products").update(row).eq("id", draft.id) : await sb.from("products").insert(row);
    setBusy(false);
    if (error) return setErr("Não foi possível salvar o produto.");
    setDraft(null); load();
  }
  async function remove(id: string) {
    if (!window.confirm("Excluir este produto? Pedidos antigos continuam guardados. Para só esconder da loja, use 'Ativo'.")) return;
    const { error } = await getSupabase().from("products").delete().eq("id", id);
    if (error) setErr("Não foi possível excluir."); else { setDraft(null); load(); }
  }
  async function toggle(p: Product) {
    await getSupabase().from("products").update({ active: !p.active }).eq("id", p.id); load();
  }
  async function photo(file: File | undefined) {
    if (!file || !draft) return;
    setBusy(true); setErr("");
    try { const url = await uploadProductPhoto(file); setDraft((d) => (d ? { ...d, image_url: url } : d)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro ao enviar a foto."); }
    setBusy(false);
  }

  if (draft) {
    return (
      <div className="card">
        <h3 style={{ marginBottom: 12 }}>{draft.id ? "Editar produto" : "Novo produto"}</h3>
        <div className="prow" style={{ marginBottom: 12 }}>
          <div className="thumb" style={{ width: 84, height: 84 }}>{draft.image_url ? <img src={draft.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <ProductArt category={draft.category} />}</div>
          <div className="grow">
            <input id="foto" type="file" accept="image/*" onChange={(e) => photo(e.target.files?.[0])} style={{ display: "none" }} />
            <label htmlFor="foto" className="btn ghost sm" style={{ display: "inline-block" }}>{draft.image_url ? "Trocar foto" : "Enviar foto"}</label>
            {draft.image_url && <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => setDraft({ ...draft, image_url: null })}>Tirar</button>}
          </div>
        </div>
        <label className="field"><span>Nome</span><input value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
        <div className="row">
          <label className="field"><span>Categoria</span>
            <input list="cats" value={draft.category} maxLength={40} onChange={(e) => setDraft({ ...draft, category: e.target.value })} />
            <datalist id="cats">{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="field"><span>Preço (R$)</span><input inputMode="decimal" value={draft.price} placeholder="0,00" onChange={(e) => setDraft({ ...draft, price: e.target.value })} /></label>
          <label className="field"><span>Estoque</span><input inputMode="numeric" value={draft.stock} placeholder="vazio = sem controle" onChange={(e) => setDraft({ ...draft, stock: e.target.value.replace(/\D/g, "") })} /></label>
        </div>
        <label className="field"><span>Descrição (opcional)</span><textarea value={draft.description} maxLength={500} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        <label className="switch"><input type="checkbox" checked={draft.active} onChange={(e) => setDraft({ ...draft, active: e.target.checked })} /> Aparece na loja</label>
        {err && <p className="error">{err}</p>}
        <div className="acts">
          <button className="btn" disabled={busy} onClick={save}>{busy ? "Salvando…" : "Salvar"}</button>
          <button className="btn ghost" onClick={() => { setDraft(null); setErr(""); }}>Cancelar</button>
          {draft.id && <button className="btn ghost" onClick={() => remove(draft.id!)}>Excluir</button>}
        </div>
      </div>
    );
  }

  return (
    <>
      <button className="btn block" style={{ marginBottom: 12 }} onClick={() => { setErr(""); setDraft(blank); }}>+ Novo produto</button>
      {err && <p className="error">{err}</p>}
      {loading && <p className="empty">Carregando…</p>}
      {!loading && !list.length && <p className="empty">Nenhum produto ainda. Toque em “Novo produto”.</p>}
      {list.map((p) => (
        <div className="card prow" key={p.id} style={{ opacity: p.active ? 1 : 0.55 }}>
          <div className="thumb">{p.image_url ? <img src={p.image_url} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : <ProductArt category={p.category} />}</div>
          <div className="grow">
            <h3 style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</h3>
            <span className="muted" style={{ fontSize: 13 }}>{p.category} · {brl(p.price)} · {p.stock === null ? "sem controle" : p.stock === 0 ? "esgotado" : `${p.stock} em estoque`}</span>
          </div>
          <div className="acts" style={{ margin: 0, flexDirection: "column" }}>
            <button className="btn ghost sm" onClick={() => edit(p)}>Editar</button>
            <button className="btn ghost sm" onClick={() => toggle(p)}>{p.active ? "Esconder" : "Mostrar"}</button>
          </div>
        </div>
      ))}
    </>
  );
}

/* --------------------------------------------------------------- configuração */
function ShopSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [phone, setPhone] = useState("");
  const [fee, setFee] = useState("0");
  const [min, setMin] = useState("0");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getSupabase().from("shop_settings").select("*").limit(1).maybeSingle().then(({ data, error }) => {
      if (error || !data) return setErr("Não foi possível carregar as configurações.");
      const d = data as Settings;
      setS(d);
      setPhone(maskPhone(d.whatsapp.replace(/^55/, "")));
      setFee(String(d.delivery_fee).replace(".", ","));
      setMin(String(d.min_order).replace(".", ","));
    });
  }, []);

  async function save() {
    if (!s) return;
    const f = parseFloat(fee.replace(",", ".")), m = parseFloat(min.replace(",", "."));
    const digits = onlyDigits(phone);
    if (digits && digits.length !== 10 && digits.length !== 11) return setErr("WhatsApp: informe DDD + número.");
    if (!(f >= 0) || !(m >= 0)) return setErr("Taxa e pedido mínimo precisam ser valores válidos.");
    setBusy(true); setErr(""); setMsg("");
    const { error } = await getSupabase().from("shop_settings").update({
      whatsapp: digits ? "55" + digits : "", delivery_enabled: s.delivery_enabled, delivery_fee: f, min_order: m, store_open: s.store_open,
    }).eq("id", true);
    setBusy(false);
    if (error) setErr("Não foi possível salvar."); else setMsg("Salvo!");
  }

  if (!s) return err ? <p className="error">{err}</p> : <p className="empty">Carregando…</p>;
  return (
    <div className="card">
      <label className="switch"><input type="checkbox" checked={s.store_open} onChange={(e) => setS({ ...s, store_open: e.target.checked })} /> Loja aberta para pedidos</label>
      <p className="muted" style={{ margin: "-4px 0 12px", fontSize: 13 }}>Desmarque quando quiser pausar os pedidos (viagem, falta de estoque…).</p>
      <label className="field"><span>WhatsApp da loja (recebe o pedido do cliente)</span>
        <input inputMode="tel" value={phone} placeholder="(21) 99999-9999" onChange={(e) => setPhone(maskPhone(e.target.value))} /></label>
      <label className="switch"><input type="checkbox" checked={s.delivery_enabled} onChange={(e) => setS({ ...s, delivery_enabled: e.target.checked })} /> Fazemos entrega</label>
      <div className="row">
        <label className="field"><span>Taxa de entrega (R$)</span><input inputMode="decimal" value={fee} onChange={(e) => setFee(e.target.value)} /></label>
        <label className="field"><span>Pedido mínimo (R$)</span><input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} /></label>
      </div>
      {err && <p className="error">{err}</p>}
      {msg && <p className="ok-text">{msg}</p>}
      <button className="btn block" disabled={busy} onClick={save}>{busy ? "Salvando…" : "Salvar"}</button>
    </div>
  );
}

// ---------------------------------------------------------------- faturamento (dashboard)
type Period = "hoje" | "7" | "30" | "tudo";
const PERIODS: { id: Period; label: string }[] = [
  { id: "hoje", label: "Hoje" }, { id: "7", label: "7 dias" }, { id: "30", label: "30 dias" }, { id: "tudo", label: "Tudo" },
];
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function Revenue() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [period, setPeriod] = useState<Period>("30");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupabase().from("orders").select("*, order_items(*)").order("created_at", { ascending: false }).limit(2000)
      .then(({ data, error }) => {
        if (error) setErr("Não foi possível carregar o faturamento."); else setOrders((data ?? []) as Order[]);
        setLoading(false);
      });
  }, []);

  const since = (() => {
    const d = new Date();
    if (period === "hoje") { d.setHours(0, 0, 0, 0); return d; }
    if (period === "tudo") return new Date(0);
    d.setDate(d.getDate() - Number(period));
    return d;
  })();

  const list = orders.filter((o) => new Date(o.created_at) >= since);
  const valid = list.filter((o) => o.status !== "cancelado");
  const sum = (arr: Order[]) => arr.reduce((t, o) => t + Number(o.total), 0);
  const revenue = sum(valid);
  const received = sum(valid.filter((o) => o.paid));
  const pending = revenue - received;
  const avg = valid.length ? revenue / valid.length : 0;
  const cancelled = list.length - valid.length;

  // últimos 7 dias (sempre, independente do período)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (6 - i)); return d;
  });
  const byDay = days.map((d) => {
    const k = dayKey(d);
    return { d, v: sum(orders.filter((o) => o.status !== "cancelado" && dayKey(new Date(o.created_at)) === k)) };
  });
  const maxDay = Math.max(1, ...byDay.map((x) => x.v));

  const byType = ["retirada", "entrega"].map((k) => {
    const arr = valid.filter((o) => o.delivery_type === k);
    return { k, n: arr.length, v: sum(arr) };
  });

  const prod = new Map<string, { qty: number; value: number }>();
  for (const o of valid) {
    for (const i of o.order_items ?? []) {
      const cur = prod.get(i.product_name) ?? { qty: 0, value: 0 };
      cur.qty += i.quantity;
      cur.value += Number(i.unit_price) * i.quantity;
      prod.set(i.product_name, cur);
    }
  }
  const top = [...prod.entries()].sort((a, b) => b[1].value - a[1].value).slice(0, 5);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Faturamento</h2>
        <div className="chips">
          {PERIODS.map((p) => (
            <button key={p.id} className={`chip ${period === p.id ? "on" : ""}`} onClick={() => setPeriod(p.id)}>{p.label}</button>
          ))}
        </div>
      </div>

      {err && <p className="error">{err}</p>}
      {loading ? <p className="empty">Carregando…</p> : (
        <>
          <div className="kpis">
            <div className="kpi"><span>Faturamento</span><b>{brl(revenue)}</b></div>
            <div className="kpi"><span>Recebido</span><b>{brl(received)}</b></div>
            <div className="kpi"><span>A receber</span><b>{brl(pending)}</b></div>
            <div className="kpi"><span>Pedidos</span><b>{valid.length}</b>{cancelled > 0 && <small>{cancelled} cancelado(s)</small>}</div>
            <div className="kpi"><span>Ticket médio</span><b>{brl(avg)}</b></div>
          </div>

          <div className="dash-card">
            <h3>Últimos 7 dias</h3>
            <div className="bars">
              {byDay.map(({ d, v }) => (
                <div key={dayKey(d)} className="bar-col">
                  <b>{v ? brl(v) : "—"}</b>
                  <div className="bar-track"><i style={{ height: `${Math.round((v / maxDay) * 100)}%` }} /></div>
                  <span>{d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="dash-card">
            <h3>Retirada x entrega</h3>
            {byType.map((x) => (
              <div key={x.k} className="dash-row"><span>{x.k === "entrega" ? "Entrega" : "Retirada"} ({x.n})</span><b>{brl(x.v)}</b></div>
            ))}
          </div>

          <div className="dash-card">
            <h3>Mais vendidos</h3>
            {top.length === 0 && <p className="empty">Nenhuma venda no período.</p>}
            {top.map(([name, t]) => (
              <div key={name} className="dash-row"><span>{name} · {t.qty}x</span><b>{brl(t.value)}</b></div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- clientes (cartela, vem dos pedidos)
type ClientRow = { phone: string; name: string; orders: number; spent: number; last: string };

function Clients() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSupabase().from("orders").select("*").order("created_at", { ascending: false }).limit(5000)
      .then(({ data, error }) => {
        if (error) setErr("Não foi possível carregar os clientes."); else setOrders((data ?? []) as Order[]);
        setLoading(false);
      });
  }, []);

  // um cliente por telefone; nome e última compra vêm do pedido mais recente
  const map = new Map<string, ClientRow>();
  for (const o of orders) {
    const cur = map.get(o.customer_phone) ?? { phone: o.customer_phone, name: o.customer_name, orders: 0, spent: 0, last: o.created_at };
    if (o.status !== "cancelado") { cur.orders += 1; cur.spent += Number(o.total); }
    map.set(o.customer_phone, cur);
  }
  const all = [...map.values()];

  const term = q.trim().toLowerCase();
  const digits = onlyDigits(q);
  const list = all.filter((c) => !term || c.name.toLowerCase().includes(term) || (digits !== "" && c.phone.includes(digits)));

  function exportCsv() {
    const head = "Nome;Telefone;Pedidos;Total gasto;Ultima compra";
    const lines = list.map((c) => [c.name, c.phone, c.orders, c.spent.toFixed(2).replace(".", ","), fmtDateTime(c.last)]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(";"));
    const blob = new Blob(["\uFEFF" + [head, ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "clientes-shalomshop.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Clientes <span className="muted" style={{ fontSize: 14 }}>({all.length})</span></h2>
        <button className="btn ghost sm" disabled={list.length === 0} onClick={exportCsv}>Exportar CSV</button>
      </div>
      <input className="search" type="search" placeholder="Buscar por nome ou telefone…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" style={{ marginBottom: 12 }} />

      {err && <p className="error">{err}</p>}
      {loading ? <p className="empty">Carregando…</p> : (
        <div className="dash-card">
          {list.length === 0 && <p className="empty">{all.length === 0 ? "Nenhum cliente ainda. Eles aparecem aqui depois do primeiro pedido." : "Nenhum cliente encontrado."}</p>}
          {list.map((c) => (
            <div key={c.phone} className="dash-row" style={{ alignItems: "center" }}>
              <div style={{ minWidth: 0 }}>
                <b style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</b>
                <span className="muted" style={{ fontSize: 12 }}>{maskPhone(c.phone)} · {c.orders} {c.orders === 1 ? "pedido" : "pedidos"} · {brl(c.spent)}</span>
                <span className="muted" style={{ display: "block", fontSize: 12 }}>Última compra: {fmtDateTime(c.last)}</span>
              </div>
              <a className="btn ghost sm" style={{ textDecoration: "none", whiteSpace: "nowrap" }} target="_blank" rel="noopener noreferrer"
                href={whatsappLink("55" + c.phone, `Olá ${c.name.split(" ")[0]}! Tudo bem?`)}>WhatsApp</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
