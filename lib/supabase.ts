import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

// Criado só quando o navegador precisa (evita erro durante o build)
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Variáveis do Supabase não configuradas (.env.local).");
    }
    client = createClient(url, key);
  }
  return client;
}
