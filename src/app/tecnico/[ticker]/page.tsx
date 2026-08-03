import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { calcularTechnicals } from "@/lib/technical-dados";
import { calcularConfluencias } from "@/lib/confluencia-dados";
import { ROTULO_CONVICCAO } from "@/lib/confluencia";
import { ROTULO_MODELO } from "@/lib/setores";
import { ROTULO_TIMING } from "@/lib/technical/types";

export const dynamic = "force-dynamic";

function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export default async function TecnicoDetalhe({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const tk = ticker.toUpperCase();

  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/tecnico" titulo="Técnico">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const [linhas, confluencias] = await Promise.all([
    calcularTechnicals(supabase),
    calcularConfluencias(supabase),
  ]);
  const l = linhas.find((x) => x.ticker === tk);
  if (!l) notFound();
  const conf = confluencias.find((x) => x.ticker === tk);

  const r = l.resultado;

  return (
    <Shell
      ativo="/tecnico"
      titulo={`Técnico — ${l.ticker}`}
      subtitulo="Cada componente, com nota ou com o motivo de estar sem nota. O gráfico nunca aprova sozinho uma empresa ruim."
      rolagem
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          <span className="font-mono font-semibold text-slate-100">{l.ticker}</span>
          <span className="ml-2">{l.nome}</span>
          <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
            {l.modelo ? ROTULO_MODELO[l.modelo] : "sem modelo"}
          </span>
        </p>
        <Link href="/tecnico" className="text-[12px] text-sky-400 hover:underline">
          ← voltar ao Técnico
        </Link>
      </div>

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Technical Score</h2>
        <p className="mt-2 text-3xl font-bold text-emerald-300">{r.score ?? "—"}</p>
        <p className="mt-1 text-[12.5px] text-slate-400">
          {r.componentesDisponiveis} de {r.componentesTotal} componentes com dado real · confiança {r.confianca} ·{" "}
          {r.barrasDisponiveis} pregões coletados
        </p>
        {r.timing && (
          <p className="mt-2 text-[12.5px] text-slate-300">
            Timing: <span className="font-semibold">{ROTULO_TIMING[r.timing]}</span> — {r.fraseTiming}.
          </p>
        )}
        <p className="mt-2 text-[12.5px] text-slate-300">
          Tese técnica: <span className="font-semibold uppercase">{r.teseTecnica.replace("_", " ")}</span> —{" "}
          {r.explicacaoTese}
        </p>
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

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
          Volatilidade (informativo — fora do Technical Score)
        </h2>
        <div className="mt-2 flex gap-6 text-[12.5px] text-slate-300">
          <p>
            ATR(14): <span className="font-mono font-semibold text-slate-100">{r.atr14 !== null ? fmt(r.atr14) : "sem dado"}</span>
          </p>
          {r.bollinger && (
            <p>
              Bollinger(20,2): banda inf. <span className="font-mono">{fmt(r.bollinger.inferior)}</span> · média{" "}
              <span className="font-mono">{fmt(r.bollinger.media)}</span> · banda sup.{" "}
              <span className="font-mono">{fmt(r.bollinger.superior)}</span> (largura {(r.bollinger.largura * 100).toFixed(1)}%)
            </p>
          )}
        </div>
      </section>

      {conf && (
        <section className="rounded-2xl border border-sky-400/20 bg-sky-500/[0.04] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-sky-300/80">Confluência</h2>
          <p className="mt-2 text-2xl font-bold text-sky-200">
            {conf.resultado.score ?? "—"}{" "}
            <span className="ml-2 text-sm font-normal text-slate-400">
              {ROTULO_CONVICCAO[conf.resultado.conviccao]}
            </span>
          </p>
          <div className="mt-2 space-y-1">
            {conf.resultado.componentes.map((c) => (
              <p key={c.id} className="text-[11.5px] text-slate-400">
                <span className="text-slate-300">{c.nome}</span> ({(c.peso * 100).toFixed(0)}%):{" "}
                {c.valor === null ? "sem dado" : Math.round(c.valor)}
              </p>
            ))}
          </div>
          <p className="mt-2 text-[10.5px] leading-snug text-slate-600">{conf.resultado.metodo}</p>
        </section>
      )}

      <p className="text-[11px] text-slate-600">
        Metodologia completa (fórmulas, pesos, limitações, hipóteses, versionamento):
        roadmap/technical-engine-v1.md. Nada aqui é recomendação de compra ou venda — é leitura de timing sobre
        uma tese fundamentalista que já existe (ou não), sem garantia de resultado futuro.
      </p>
    </Shell>
  );
}
