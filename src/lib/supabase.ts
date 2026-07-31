import { createClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase (browser/anon).
 *
 * Preencha as variáveis no arquivo .env.local (copie de .env.example)
 * e, na Vercel, em Settings → Environment Variables.
 *
 * Fundação (Parte 2.5 do roadmap): RLS ligado em todas as tabelas de
 * usuário; a chave anon NUNCA dá acesso a dados de outro usuário.
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
