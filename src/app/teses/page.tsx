import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

type Tese = {
  id: string;
  ticker: string;
  versao: number;
  status: string;
  confianca: string;
  texto: string;
  criado_em: string;
  empresas: { nome: string; setor: string | null } | null;
};

const STATUS_UI: Record<string, { rotulo: string; cor: string; ponto: string }> = {
  valida: { rotulo: "Válida", cor: "text-emerald-300 border-emerald-500/30 bg-emerald-500/10", ponto: "bg-emerald-400" },
  em_revisao: { rotulo: "Em revisão", cor: "text-amber-300 border-amber-500/30 bg-amber-500/10", ponto: "bg-amber-400" },
  quebrada: { rotulo: "Quebrada", cor: "text-red-300 border-red-500/30 bg-red-500/10", ponto: "bg-red-400" },
};

export default async function Teses() {
  let teses: Tese[] = [];
  let erro: string | null = null;

  if (!isSupabaseConfigured || !supabase) {
    erro = "Supabase não configurado.";
  } else {
    const { data, error } = await supabase
      .from("teses")
      .select("id, ticker, versao, status, confianca, texto, criado_em, empresas(nome, setor)")
      .eq("ativa", true)
      .order("ticker");
    if (error) erro = error.message;
    else teses = (data as unknown as Tese[]) ?? [];
  }

  return (
    <Shell
      ativo="/teses"
      titulo="Teses Vivas"
      subtitulo="O centro do sistema: cada empresa é o veículo de uma tese — e a tese evolui sozinha quando os dados mudam. Válida = dados confirmam · Em revisão = alerta disparou, estude · Quebrada = premissa caiu."
    >
      {erro && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
          {erro}
        </div>
      )}
      <div className="grid min-h-0 flex-1 grid-cols-1 content-start gap-3 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
        {teses.map((t) => {
          const ui = STATUS_UI[t.status] ?? STATUS_UI.valida;
          return (
            <Link
              key={t.id}
              href={`/tese/${t.ticker}`}
              className="group flex flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-all hover:border-emerald-500/30 hover:bg-white/[0.05]"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${ui.ponto}`} />
                  <span className="font-mono text-lg font-bold">{t.ticker}</span>
                </div>
                <span className={`rounded-full border px-2.5 py-0.5 text-[10px] ${ui.cor}`}>
                  {ui.rotulo}
                </span>
              </div>
              <p className="mt-0.5 text-sm text-slate-400">
                {t.empresas?.nome}
                <span className="text-slate-600"> · {t.empresas?.setor}</span>
              </p>
              <p className="mt-2 line-clamp-3 text-[12px] leading-snug text-slate-500">
                {t.texto}
              </p>
              <div className="mt-auto flex items-center justify-between pt-3 text-[10px] uppercase tracking-wider text-slate-600">
                <span>v{t.versao} · convicção {t.confianca}</span>
                <span className="text-emerald-500/0 transition-colors group-hover:text-emerald-400">
                  abrir →
                </span>
              </div>
            </Link>
          );
        })}
        {teses.length === 0 && !erro && (
          <p className="text-slate-500">Nenhuma tese ainda.</p>
        )}
      </div>
    </Shell>
  );
}
