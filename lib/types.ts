export type Product = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  price: number;
  stock: number | null; // vazio = não controla estoque
  image_url: string | null;
  active: boolean;
};

export type Settings = {
  whatsapp: string; // só dígitos, com DDI (ex.: 5521999999999)
  delivery_enabled: boolean;
  delivery_fee: number;
  min_order: number;
  store_open: boolean;
};

export type DeliveryType = "retirada" | "entrega";
export type OrderStatus = "novo" | "confirmado" | "pronto" | "entregue" | "cancelado";

export type OrderItem = {
  id: string;
  product_name: string;
  unit_price: number;
  quantity: number;
};

export type Order = {
  id: string;
  code: string;
  customer_name: string;
  customer_phone: string;
  delivery_type: DeliveryType;
  address: string | null;
  notes: string | null;
  subtotal: number;
  delivery_fee: number;
  total: number;
  status: OrderStatus;
  paid: boolean;
  created_at: string;
  order_items?: OrderItem[];
};

export type CartLine = { id: string; qty: number };

// Categorias sugeridas. Na prática o dono pode digitar qualquer categoria nova no painel.
export const CATEGORIES = [
  "Limpeza",
  "Vassouras e rodos",
  "Panos e esponjas",
  "Papelaria",
  "Casa e organização",
  "Outros",
] as const;
