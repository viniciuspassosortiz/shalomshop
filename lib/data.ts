import { getSupabase } from "./supabase";
import { DEMO_PRODUCTS, DEMO_SETTINGS } from "./demo";
import type { CartLine, DeliveryType, Product, Settings } from "./types";

// Sem as variáveis do Supabase o site abre em modo demonstração (dados de exemplo).
export const hasBackend = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export async function loadStore(): Promise<{ products: Product[]; settings: Settings; demo: boolean }> {
  if (!hasBackend()) return { products: DEMO_PRODUCTS, settings: DEMO_SETTINGS, demo: true };
  const sb = getSupabase();
  const [pr, st] = await Promise.all([
    sb.from("products").select("*").eq("active", true).order("category").order("name"),
    sb.from("shop_settings").select("*").limit(1).maybeSingle(),
  ]);
  if (pr.error || st.error) throw new Error("Não foi possível carregar a loja.");
  const s = st.data as Settings | null;
  return {
    products: (pr.data ?? []).map((x) => ({ ...x, price: Number(x.price) })) as Product[],
    settings: s
      ? { ...s, delivery_fee: Number(s.delivery_fee), min_order: Number(s.min_order) }
      : { ...DEMO_SETTINGS, whatsapp: "", store_open: true },
    demo: false,
  };
}

export type NewOrder = {
  name: string;
  phone: string;
  delivery: DeliveryType;
  address: string;
  notes: string;
  items: CartLine[];
};

export async function placeOrder(o: NewOrder): Promise<{ code: string; total: number }> {
  if (!hasBackend()) {
    await new Promise((r) => setTimeout(r, 500));
    return { code: "SS-DEMO1", total: 0 };
  }
  const { data, error } = await getSupabase().rpc("create_order", {
    p_name: o.name,
    p_phone: o.phone,
    p_delivery: o.delivery,
    p_address: o.delivery === "entrega" ? o.address : null,
    p_notes: o.notes || null,
    p_items: o.items.map((l) => ({ id: l.id, qty: l.qty })),
  });
  if (error) {
    // as mensagens do banco já vêm em português e prontas para mostrar
    throw new Error(error.message || "Não foi possível enviar o pedido. Tente de novo.");
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.order_code) throw new Error("Não foi possível enviar o pedido. Tente de novo.");
  return { code: row.order_code as string, total: Number(row.order_total) };
}
