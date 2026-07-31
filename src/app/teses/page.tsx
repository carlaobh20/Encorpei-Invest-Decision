import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Tese = {
  id: string;
  ticker: string;
  versao: number;
  status: string;
  confianca: string;
  criado_em: string;
  empresas: { nome: string } | null;
};

const STATUS_UI: Record<string, { rotulo: string; cor: string }> = {
  valida: { rotulo: "Válida", cor: "text-emerald-400 border-emerald-700" },
  em_revisao: { rotulo: "Em revisão", cor: "text-amber-400 border-amber-700" },
  quebrada: { rotulo: "Quebrada", cor: "text-red-400 border-red-700" },
};

export default async function Teses() {
  let teses: Tese[] = [];
  let erro: string | null = null;

  if (!isSupabaseConfigured || !supabase) {
    erro = "Supabase não configurado.";
  } else {
    const { data, error } = await supabase
      .from("teses")
      .select("id, ticker, versao, status, confianca, criado_em, empresas(nome)")
      .eq("ativa", true)
      .order("ticker");
    if (error) erro = error.message;
    else teses = (data as unknown as Tese[]) ?? [];
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">
          Fase 2 · Tese Viva
        </p>
        <h1 className="mt-2 text-3xl font-bold">Teses</h1>
        <p className="mt-2 text-sm text-slate-400">
          O centro do sistema. Cada empresa é um veículo de uma tese — e a
          tese evolui sozinha quando os dados mudam.
        </p>

        {erro && (
          <div className="mt-8 rounded-xl border border-amber-700 bg-amber-950/40 p-4 text-amber-300">
            {erro}
          </div>
        )}

        <div className="mt-8 space-y-3">
          {teses.map((t) => {
            const ui = STATUS_UI[t.status] ?? STATUS_UI.valida;
            return (
              <Link
                key={t.id}
                href={`/tese/${t.ticker}`}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 p-4 hover:border-slate-600"
              >
                <div>
                  <span className="font-mono font-semibold">{t.ticker}</span>
                  <span className="ml-3 text-slate-400">
                    {t.empresas?.nome ?? ""}
                  </span>
                  <span className="ml-3 text-xs text-slate-600">
                    v{t.versao}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-slate-500">
                    Convicção: {t.confianca}
                  </span>
                  <span className={`rounded-full border px-3 py-1 ${ui.cor}`}>
                    {ui.rotulo}
                  </span>
                </div>
              </Link>
            );
          })}
          {teses.length === 0 && !erro && (
            <p className="text-slate-500">
              Nenhuma tese ainda — rode a migração 004.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
