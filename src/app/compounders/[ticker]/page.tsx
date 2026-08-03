import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { calcularCompounders } from "@/lib/compounder-dados";
import { ROTULO_MODELO } from "@/lib/setores";
import { ROTULO_SENSIBILIDADE } from "@/lib/compounder/sensibilidade-juros";

export const dynamic = "force-dynamic";

export default async function CompounderDetalhe({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const tk = ticker.toUpperCase();

  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/compounders" titulo="Compounder">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const linhas = await calcularCompounders(supabase);
  const l = linhas.find((x) => x.ticker === tk);
  if (!l) notFound();

  const r = l.resultado;

  return (
    <Shell
      ativo="/compounders"
      titulo={`Compounder — ${l.ticker}`}
      subtitulo="Cada componente, com nota ou com o motivo de estar sem nota. Nada é escondido, nada é inventado."
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          <span className="font-mono font-semibold text-slate-100">{l.ticker}</span>
          <span className="ml-2">{l.nome}</span>
          <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
            {l.modelo ? ROTULO_MODELO[l.modelo] : "sem modelo"}
          </span>
        </p>
        <Link href="/compounders" className="text-[12px] text-sky-400 hover:underline">
          ← voltar aos Compounders
        </Link>
      </div>

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Compounder Score</h2>
        <p className="mt-2 text-3xl font-bold text-emerald-300">{r.score ?? "—"}</p>
        <p className="mt-1 text-[12.5px] text-slate-400">
          {r.componentesDisponiveis} de {r.componentesTotal} componentes com dado real · confiança {r.confianca} ·{" "}
          {r.metodo}
        </p>
        {l.sensibilidadeSelic.categoria && (
          <p className="mt-2 text-[12.5px] text-slate-300">
            Sensibilidade à queda da Selic:{" "}
            <span className="font-semibold">{ROTULO_SENSIBILIDADE[l.sensibilidadeSelic.categoria]}</span> —{" "}
            {l.sensibilidadeSelic.explicacao}. Heurística v1, não calibrada contra histórico real de preço.
          </p>
        )}
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Componentes</h2>
        <div className="mt-2 space-y-2">
          {r.componentes.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/5 bg-black/20 p-3">
              <div className="flex items-center justify-between">
                <p className="text-[12.5px] font-semibold text-slate-200">
                  {c.nome} <span className="text-slate-500">· peso {(c.peso * 100).toFixed(0)}%</span>
                </p>
                <p className={`text-sm font-bold ${c.valor === null ? "text-slate-600" : "text-slate-100"}`}>
                  {c.valor === null ? "sem dado" : Math.round(c.valor)}
                </p>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-slate-500">{c.explicacao}</p>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[11px] text-slate-600">
        Metodologia completa (fórmulas, pesos, limitações, hipóteses, versionamento):
        roadmap/compounder-engine-v1.md. Nada aqui é recomendação de compra ou venda — é classificação por
        fundamentos consistentes e auditáveis, sem garantia de resultado futuro.
      </p>
    </Shell>
  );
}
