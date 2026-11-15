import type { CartLine, Product, Settings } from "./types";

export const MAX_QTY = 20;

export function addToCart(cart: CartLine[], p: Product, qty = 1): CartLine[] {
  const max = Math.min(MAX_QTY, p.stock ?? MAX_QTY);
  const cur = cart.find((l) => l.id === p.id);
  if (!cur) return max < 1 ? cart : [...cart, { id: p.id, qty: Math.min(qty, max) }];
  return cart.map((l) => (l.id === p.id ? { ...l, qty: Math.min(max, l.qty + qty) } : l));
}

export function setQty(cart: CartLine[], p: Product, qty: number): CartLine[] {
  const max = Math.min(MAX_QTY, p.stock ?? MAX_QTY);
  if (qty <= 0) return cart.filter((l) => l.id !== p.id);
  return cart.map((l) => (l.id === p.id ? { ...l, qty: Math.min(max, qty) } : l));
}

// Remove do carrinho o que saiu do ar e ajusta a quantidade ao estoque
export function reconcile(cart: CartLine[], products: Product[]): CartLine[] {
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: CartLine[] = [];
  for (const l of cart) {
    const p = byId.get(l.id);
    if (!p || !p.active) continue;
    const max = Math.min(MAX_QTY, p.stock ?? MAX_QTY);
    if (max < 1) continue;
    out.push({ id: l.id, qty: Math.min(l.qty, max) });
  }
  return out;
}

export function totals(cart: CartLine[], products: Product[], settings: Settings, delivery: boolean) {
  const byId = new Map(products.map((p) => [p.id, p]));
  const subtotal = cart.reduce((s, l) => s + (byId.get(l.id)?.price ?? 0) * l.qty, 0);
  const fee = delivery && settings.delivery_enabled ? settings.delivery_fee : 0;
  return { subtotal, fee, total: subtotal + fee, count: cart.reduce((s, l) => s + l.qty, 0) };
}

export function whatsappLink(phoneDigits: string, text: string) {
  return `https://wa.me/${phoneDigits}?text=${encodeURIComponent(text)}`;
}
