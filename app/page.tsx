"use client";

import { useEffect, useMemo, useState } from "react";
import Mark from "@/components/Mark";
import ProductArt from "@/components/ProductArt";
import { loadStore, placeOrder } from "@/lib/data";
import { addToCart, reconcile, setQty, totals, whatsappLink } from "@/lib/cart";
import { brl, maskPhone, onlyDigits, validPhone } from "@/lib/format";
import { CATEGORIES } from "@/lib/types";
import type { CartLine, DeliveryType, Product, Settings } from "@/lib/types";

const CART_KEY = "ss-cart";

// leitura/escrita do navegador sempre protegidas (modo privado pode bloquear)
const readLS = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const writeLS = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignora */ } };

type Done = { code: string; total: number; name: string; delivery: DeliveryType; lines: { name: string; qty: number; price: number }[]; fee: number };

export default function Store() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [demo, setDemo] = useState(false);
  const [loadErr, setLoadErr] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cat, setCat] = useState("Todos");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState<"" | "cart" | "checkout" | "done">("");
  const [form, setForm] = useState({ name: "", phone: "", street: "", number: "", neighborhood: "", reference: "", notes: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    try { setCart(JSON.parse(readLS(CART_KEY) || "[]")); } catch { setCart([]); }
    loadStore()
      .then(({ products, settings, demo }) => { setProducts(products); setSettings(settings); setDemo(demo); })
      .catch(() => setLoadErr("Não foi possível carregar os produtos. Atualize a página."));
  }, []);

  // ajusta o carrinho ao que existe e ao estoque, e guarda no aparelho
  useEffect(() => {
    if (!products.length) return;
    setCart((c) => {
      const r = reconcile(c, products);
      return JSON.stringify(r) === JSON.stringify(c) ? c : r;
    });
  }, [products]);
  useEffect(() => { writeLS(CART_KEY, JSON.stringify(cart)); }, [cart]);

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);
  const cats = useMemo(() => {
    const present = new Set(products.map((p) => p.category));
    const ordered = [...CATEGORIES.filter((c) => present.has(c)), ...[...present].filter((c) => !(CATEGORIES as readonly string[]).includes(c)).sort()];
    return ["Todos", ...ordered];
  }, [products]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return products.filter((p) => (cat === "Todos" || p.category === cat) && (!t || p.name.toLowerCase().includes(t) || (p.description ?? "").toLowerCase().includes(t)));
  }, [products, cat, q]);
  const groups = useMemo(() => {
    const m = new Map<string, Product[]>();
    for (const p of shown) m.set(p.category, [...(m.get(p.category) ?? []), p]);
    return [...m.entries()];
  }, [shown]);

  const st: Settings = settings ?? { whatsapp: "", delivery_enabled: true, delivery_fee: 0, min_order: 0, store_open: true };
  // só entrega: o pedido é sempre de entrega, quando a loja estiver fazendo entregas
  const delivery: DeliveryType = "entrega";
  const isDelivery = st.delivery_enabled;
  const tot = totals(cart, products, st, isDelivery);
  const missingMin = Math.max(0, st.min_order - tot.subtotal);
  const qtyOf = (id: string) => cart.find((l) => l.id === id)?.qty ?? 0;

  const closeSheet = () => { setSheet(""); setErr(""); };

  async function submit() {
    setErr("");
    if (form.name.trim().length < 2) return setErr("Informe seu nome.");
    if (!validPhone(form.phone)) return setErr("Informe um telefone válido com DDD.");
    if (isDelivery && (form.street.trim().length < 2 || form.number.trim().length < 1 || form.neighborhood.trim().length < 2)) return setErr("Informe rua, número e bairro para a entrega.");
    setBusy(true);
    try {
      const lines = cart.map((l) => { const p = byId.get(l.id)!; return { name: p.name, qty: l.qty, price: p.price }; });
      const r = await placeOrder({ name: form.name.trim(), phone: onlyDigits(form.phone), delivery: isDelivery ? "entrega" : "retirada", address: isDelivery ? fullAddress() : "", notes: form.notes.trim(), items: cart });
      setDone({ code: r.code, total: r.total || tot.total, name: form.name.trim(), delivery: isDelivery ? "entrega" : "retirada", lines, fee: tot.fee });
      setCart([]);
      setSheet("done");
      // estoque mudou: recarrega
      loadStore().then(({ products }) => setProducts(products)).catch(() => {});
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Não foi possível enviar o pedido.");
    } finally {
      setBusy(false);
    }
  }

  function fullAddress() {
    const base = `${form.street.trim()}, ${form.number.trim()} - ${form.neighborhood.trim()}`;
    const ref = form.reference.trim();
    return ref ? `${base} (Ref: ${ref})` : base;
  }

  function waText(d: Done) {
    const items = d.lines.map((l) => `• ${l.qty}x ${l.name} — ${brl(l.price * l.qty)}`).join("\n");
    return `Olá! Fiz o pedido *${d.code}* na ShalomShop.\n\n${items}\n\n${d.delivery === "entrega" ? `Entrega: taxa ${brl(d.fee)}\n` : "Retirada na loja\n"}*Total: ${brl(d.total)}*\nNome: ${d.name}\n\nPodem me confirmar o pagamento e ${d.delivery === "entrega" ? "a entrega" : "a retirada"}? Obrigado!`;
  }

  return (
    <>
      {demo && <div className="demo">Modo demonstração: produtos de exemplo, nenhum pedido é enviado de verdade.</div>}
      {!st.store_open && <div className="closed">A loja não está aceitando pedidos agora. Volte em breve!</div>}

      <header className="top">
        <div className="wrap">
          <a className="logo-s" href="#"><img src="/logo-shalomshop.jpg" alt="ShalomShop" className="logo-img" /></a>
          <button className="cart-btn" aria-label="Abrir carrinho" onClick={() => setSheet("cart")}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M6 7h13l-1.6 8.2a2 2 0 0 1-2 1.6H9.2a2 2 0 0 1-2-1.6L5.4 4H3" /><circle cx="10" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" />
            </svg>
            {tot.count > 0 && <i>{tot.count}</i>}
          </button>
        </div>
      </header>

      <section className="hero">
        <div className="wrap">
          <img src="/logo-shalomshop.jpg" alt="ShalomShop" className="hero-logo" />
          <div className="sub">Variedades</div>
          <p>Limpeza, vassouras e rodos, panos, papelaria e muito mais. Escolha seus produtos, envie o pedido e combinamos tudo pelo WhatsApp.</p>
          <div className="badges">
            <span>🛒 Pedido em 1 minuto</span><span>🏪 Retire na loja ou receba</span><span>💬 Atendimento pelo WhatsApp</span>
          </div>
        </div>
      </section>

      <main className="wrap" id="produtos">
        <div className="tools">
          <input className="search" type="search" placeholder="Buscar produto…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar produto" />
          <div className="chips">
            {cats.map((c) => (
              <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
        </div>

        {loadErr && <p className="error">{loadErr}</p>}
        {!loadErr && !products.length && !settings && <p className="empty">Carregando produtos…</p>}
        {settings && !shown.length && <p className="empty">Nenhum produto encontrado.</p>}

        {groups.map(([name, list]) => (
          <section key={name}>
            <h2 className="sec">{name}</h2>
            <div className="grid">
              {list.map((p) => {
                const out = p.stock !== null && p.stock < 1;
                const n = qtyOf(p.id);
                return (
                  <article className="pc" key={p.id}>
                    <div className="img">
                      {p.image_url ? <img src={p.image_url} alt={p.name} loading="lazy" /> : <ProductArt category={p.category} />}
                      {out ? <span className="tag out">Esgotado</span> : p.stock !== null && p.stock <= 3 ? <span className="tag">Últimas unidades</span> : null}
                    </div>
                    <div className="info">
                      <h3>{p.name}</h3>
                      {p.description && <p className="desc">{p.description}</p>}
                      <div className="price">{brl(p.price)}</div>
                      {n > 0 ? (
                        <div className="step">
                          <button aria-label="Tirar um" onClick={() => setCart((c) => setQty(c, p, n - 1))}>−</button>
                          <b>{n}</b>
                          <button aria-label="Adicionar mais um" onClick={() => setCart((c) => addToCart(c, p))}>+</button>
                        </div>
                      ) : (
                        <button className="add" disabled={out || !st.store_open} onClick={() => setCart((c) => addToCart(c, p))}>
                          {out ? "Esgotado" : "Adicionar"}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ))}

        <footer className="foot">
          <b>ShalomShop</b>
          <p>Variedades para sua casa, seu trabalho e seus estudos.</p>
          <p className="credit">Desenvolvido por V.S.P</p>
        </footer>
      </main>

      {tot.count > 0 && !sheet && (
        <button className="cartbar" onClick={() => setSheet("cart")}>
          <span>Ver carrinho · {tot.count} {tot.count === 1 ? "item" : "itens"}</span>
          <b>{brl(tot.subtotal)}</b>
        </button>
      )}

      {sheet && (
        <div className="shade" onClick={closeSheet}>
          <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            {sheet === "cart" && (
              <>
                <h2>Seu carrinho <button className="x" aria-label="Fechar" onClick={closeSheet}>✕</button></h2>
                {!cart.length ? (
                  <p className="empty">Seu carrinho está vazio.</p>
                ) : (
                  <>
                    {cart.map((l) => {
                      const p = byId.get(l.id);
                      if (!p) return null;
                      return (
                        <div className="line" key={l.id}>
                          <div className="nm">{p.name}</div>
                          <div className="pr">{brl(p.price * l.qty)}</div>
                          <div className="muted">{brl(p.price)} cada</div>
                          <div className="step">
                            <button aria-label="Tirar um" onClick={() => setCart((c) => setQty(c, p, l.qty - 1))}>−</button>
                            <b>{l.qty}</b>
                            <button aria-label="Adicionar mais um" onClick={() => setCart((c) => addToCart(c, p))}>+</button>
                          </div>
                        </div>
                      );
                    })}
                    <div className="note">
                      {st.delivery_enabled
                        ? `Entrega no seu endereço${st.delivery_fee > 0 ? ` · taxa ${brl(st.delivery_fee)}` : " · sem taxa"}.`
                        : "No momento não estamos fazendo entregas."}
                    </div>
                    {missingMin > 0 && <div className="note">Pedido mínimo de {brl(st.min_order)}. Faltam {brl(missingMin)}.</div>}
                    <button className="btn block" disabled={missingMin > 0 || !st.store_open || !st.delivery_enabled} onClick={() => setSheet("checkout")}>Continuar</button>
                  </>
                )}
              </>
            )}

            {sheet === "checkout" && (
              <>
                <h2>Seus dados <button className="x" aria-label="Fechar" onClick={closeSheet}>✕</button></h2>
                <label className="field"><span>Nome</span>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoComplete="name" maxLength={80} />
                </label>
                <label className="field"><span>Telefone (WhatsApp)</span>
                  <input inputMode="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} placeholder="(21) 99999-9999" autoComplete="tel" />
                </label>
                {isDelivery && (
                  <>
                    <label className="field"><span>Rua</span>
                      <input value={form.street} onChange={(e) => setForm({ ...form, street: e.target.value })} maxLength={80} autoComplete="address-line1" />
                    </label>
                    <div className="row" style={{ flexWrap: "nowrap", gap: 10 }}>
                      <label className="field" style={{ flex: 1 }}><span>Número</span>
                        <input inputMode="numeric" value={form.number} onChange={(e) => setForm({ ...form, number: e.target.value })} maxLength={10} />
                      </label>
                      <label className="field" style={{ flex: 2 }}><span>Bairro</span>
                        <input value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} maxLength={60} />
                      </label>
                    </div>
                    <label className="field"><span>Ponto de referência (opcional)</span>
                      <input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} maxLength={80} placeholder="Ex.: perto da padaria" />
                    </label>
                  </>
                )}
                <label className="field"><span>Observações (opcional)</span>
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={300} style={{ minHeight: 56 }} />
                </label>
                <div className="sum">
                  <div><span>{tot.count} {tot.count === 1 ? "item" : "itens"} · Entrega</span><span>{brl(tot.subtotal)}</span></div>
                  {isDelivery && <div><span>Entrega</span><span>{brl(tot.fee)}</span></div>}
                  <div className="tot"><span>Total</span><span>{brl(tot.total)}</span></div>
                </div>
                <div className="note">Depois de enviar, você confirma o pedido pelo WhatsApp da loja. O pagamento é combinado por lá.</div>
                {err && <p className="error">{err}</p>}
                <div className="row" style={{ marginTop: 12, flexWrap: "nowrap" }}>
                  <button className="btn ghost" onClick={() => setSheet("cart")}>Voltar</button>
                  <button className="btn block" disabled={busy} onClick={submit}>{busy ? "Enviando…" : "Enviar pedido"}</button>
                </div>
              </>
            )}

            {sheet === "done" && done && (
              <div className="done">
                <Mark size={70} />
                <h2 style={{ justifyContent: "center", marginBottom: 4 }}>Pedido enviado!</h2>
                <div className="code">{done.code}</div>
                <p className="muted">Anote o código. Total: <b style={{ color: "var(--text)" }}>{brl(done.total)}</b> · {done.delivery === "entrega" ? "Entrega" : "Retirada"}</p>
                <div className="note" style={{ textAlign: "left" }}>
                  Falta só um passo: toque no botão abaixo para avisar a loja no WhatsApp. Lá combinamos o pagamento{done.delivery === "retirada" ? " e a hora da retirada" : " e a entrega"}.
                </div>
                {st.whatsapp ? (
                  <a className="btn wa block" style={{ textAlign: "center" }} href={whatsappLink(st.whatsapp, waText(done))} target="_blank" rel="noopener noreferrer">Enviar pedido no WhatsApp</a>
                ) : (
                  <p className="muted">A loja entrará em contato pelo telefone informado.</p>
                )}
                <button className="btn ghost block" style={{ marginTop: 10 }} onClick={() => { setDone(null); closeSheet(); }}>Voltar à loja</button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
