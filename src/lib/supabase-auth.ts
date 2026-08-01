import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/** O login está ativo? Liga com NEXT_PUBLIC_AUTH_ATIVO=true na Vercel. */
export const authAtivo = () => process.env.NEXT_PUBLIC_AUTH_ATIVO === "true";

/** Cliente Supabase com a sessão do usuário (server components / actions). */
export async function supabaseComSessao() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  const cookieStore = await cookies();
  return createServerClient(url, anon, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {}, // leitura apenas; escrita de cookies fica no middleware
    },
  });
}

export async function usuarioLogado() {
  if (!authAtivo()) return null;
  const sb = await supabaseComSessao();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}
