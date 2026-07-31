import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase ADMIN (service_role) — USO EXCLUSIVO NO SERVIDOR.
 * Passa por cima do RLS: é o único caminho de escrita nos dados de mercado.
 * A chave service_role NUNCA vai para o browser nem para o repositório.
 */
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
}
