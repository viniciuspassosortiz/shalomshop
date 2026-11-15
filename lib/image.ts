import { getSupabase } from "./supabase";

// Reduz a foto (celular gera arquivos de vários MB) para no máximo 1000px.
// PNG com transparência continua PNG; o resto vira JPEG (menor).
async function resize(file: File, max = 1000): Promise<{ blob: Blob; ext: string; type: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Não foi possível ler a imagem."));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível processar a imagem.");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    let hasAlpha = false;
    if (/image\/(png|webp|gif)/.test(file.type)) {
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i] < 250) { hasAlpha = true; break; }
    }
    const type = hasAlpha ? "image/png" : "image/jpeg";
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, type, 0.88));
    if (!blob) throw new Error("Não foi possível processar a imagem.");
    return { blob, ext: hasAlpha ? "png" : "jpg", type };
  } finally {
    URL.revokeObjectURL(url);
  }
}

// Envia a foto do produto para o Storage (bucket "produtos") e devolve o endereço público.
export async function uploadProductPhoto(file: File): Promise<string> {
  if (!/^image\//.test(file.type)) throw new Error("Escolha um arquivo de imagem.");
  if (file.size > 15 * 1024 * 1024) throw new Error("Imagem grande demais (máximo 15 MB).");
  const { blob, ext, type } = await resize(file);
  const path = `${crypto.randomUUID()}.${ext}`;
  const sb = getSupabase();
  const { error } = await sb.storage.from("produtos").upload(path, blob, { contentType: type, cacheControl: "31536000" });
  if (error) throw new Error("Não foi possível enviar a foto.");
  return sb.storage.from("produtos").getPublicUrl(path).data.publicUrl;
}
