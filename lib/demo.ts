import type { Product, Settings } from "./types";

// Mostrados só enquanto o Supabase não está configurado (para visualizar o site).
export const DEMO_SETTINGS: Settings = {
  whatsapp: "5500000000000",
  delivery_enabled: true,
  delivery_fee: 5,
  min_order: 0,
  store_open: true,
};

const p = (
  n: number, name: string, category: string, price: number, stock: number | null, description: string
): Product => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
  name, category, price, stock, description, image_url: null, active: true,
});

export const DEMO_PRODUCTS: Product[] = [
  p(1, "Detergente Neutro 500 ml", "Limpeza", 3.49, 40, "Remove gordura sem agredir as mãos."),
  p(2, "Desinfetante Lavanda 2 L", "Limpeza", 12.9, 18, "Perfume suave e limpeza completa de pisos."),
  p(3, "Água Sanitária 1 L", "Limpeza", 5.9, 30, "Para roupas brancas e superfícies."),
  p(4, "Limpa Vidros 500 ml", "Limpeza", 9.9, 2, "Sem deixar marcas nem riscos."),
  p(5, "Vassoura de Pelo", "Vassouras e rodos", 8.9, 25, "Cerdas macias para pó e cantos."),
  p(6, "Rodo 40 cm", "Vassouras e rodos", 14.5, 12, "Borracha dupla, resistente e durável."),
  p(7, "Vassoura de Piaçava", "Vassouras e rodos", 19.9, 0, "Ideal para área externa e calçadas."),
  p(8, "Pano de Chão (2 unidades)", "Panos e esponjas", 7.9, 60, "Absorvente, não solta fiapos."),
  p(9, "Esponja Dupla Face (3 unidades)", "Panos e esponjas", 4.5, 80, "Um lado macio, outro para pratos pesados."),
  p(10, "Pano de Microfibra", "Panos e esponjas", 4.9, null, "Seca rápido e não risca superfícies."),
  p(11, "Caderno Universitário 10 matérias", "Papelaria", 24.9, 15, "96 folhas, capa dura."),
  p(12, "Caixa de Canetas Azuis (50)", "Papelaria", 29.9, 3, "Escrita firme e secagem rápida."),
  p(13, "Lápis Preto nº 2", "Papelaria", 1.5, 100, "Traço macio, fácil de apontar."),
  p(14, "Cola Branca 90 g", "Papelaria", 4.9, 35, "Secagem transparente, uso geral."),
  p(15, "Balde 10 L", "Casa e organização", 18.9, 10, "Reforçado, com alça de metal."),
  p(16, "Lixeira 5 L com Pedal", "Casa e organização", 39.9, 4, "Tampa silenciosa e fácil de limpar."),
  p(17, "Cabide Plástico (kit 10)", "Casa e organização", 14.9, null, "Resistente, não deixa marca nas roupas."),
  p(18, "Pilha AA (par)", "Outros", 6.5, 50, "Alta duração para controle e relógios."),
];
