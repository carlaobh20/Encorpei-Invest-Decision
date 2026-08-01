"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/**
 * Tela de login — só é alcançável quando NEXT_PUBLIC_AUTH_ATIVO=true.
 * Primeira vez: "Criar minha conta" (o próprio dono define e-mail e senha;
 * a senha nunca passa por terceiros). Depois: entrar normalmente.
 */
export default function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  // criado só no clique — nunca durante a renderização/build
  const getSupabase = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  async function entrar() {
    setCarregando(true);
    setMsg(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password: senha });
    if (error) setMsg(`Não entrou: ${error.message}`);
    else window.location.href = "/";
    setCarregando(false);
  }

  async function criarConta() {
    if (senha.length < 8) {
      setMsg("Use uma senha com pelo menos 8 caracteres.");
      return;
    }
    setCarregando(true);
    setMsg(null);
    const { error } = await getSupabase().auth.signUp({ email, password: senha });
    if (error) setMsg(`Não criou: ${error.message}`);
    else
      setMsg(
        "Conta criada. Se o Supabase pedir confirmação, verifique seu e-mail; depois clique em Entrar."
      );
    setCarregando(false);
  }

  return (
    <main className="flex h-dvh items-center justify-center bg-slate-950 text-slate-100 [background:radial-gradient(80%_60%_at_50%_0%,rgba(16,185,129,0.07),transparent),#020617]">
      <div className="w-full max-w-sm rounded-2xl border border-white/5 bg-white/[0.03] p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500">
          Encorpei <span className="text-emerald-500">Invest</span>
        </p>
        <h1 className="mt-1 text-2xl font-bold">Entrar</h1>
        <p className="mt-1 text-xs text-slate-500">
          Área privada. Suas teses, suas decisões, seus dados.
        </p>

        <div className="mt-6 space-y-3">
          <input
            type="email"
            placeholder="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && entrar()}
            className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
          />
          <button
            onClick={entrar}
            disabled={carregando}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {carregando ? "..." : "Entrar"}
          </button>
          <button
            onClick={criarConta}
            disabled={carregando}
            className="w-full rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 hover:border-emerald-500/40 disabled:opacity-50"
          >
            Primeira vez? Criar minha conta
          </button>
          {msg && <p className="text-xs text-amber-300">{msg}</p>}
        </div>
      </div>
    </main>
  );
}
