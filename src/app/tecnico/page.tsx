import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { calcularTechnicals } from "@/lib/technical-dados";
import { ROTULO_MODELO } from "@/lib/setores";
import { ROTULO_TIMING } from "@/lib/technical/types";

export const dynamic = "force-dynamic";

/**
 * TÉCNICO — o gráfico decide QUANDO, nunca O QUE. Nunca diz "compre" ou
 * "venda": só "Momento Favorável/Desfavorável" ou "Aguardar melhor ponto".
 * Metodologia completa em roadmap/technical-engine-v1.md.
 */

function corScore(n: number | null): string {
  if (n === null) return "text-slate-600";
  if (n >= 80) return "text-emerald-300";
  if (n >= 60) return "text-emerald-500";
  if (n >= 40) return "text-amber-400";
  return "text-red-400";
}

function corTiming(t: string | null): string {
  if (t === "excelente" || t === "bom") return "border-emerald-400/30 bg-emerald-500/10 text-emerald-300";
  if (t === "neutro") return "border-amber-400/30 bg-amber-500/10 text-amber-300";
  if (t === "ruim" || t === "muito_ruim") return "border-red-400/30 bg-red-500/10 text-red-300";
  return "border-white/10 text-slate-500";
}

export default async function Tecnico() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/tecnico" titulo="Técnico">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const linhas = await calcularTechnicals(supabase);
  const comScore = linhas.filter((l) => l.resultado.score !== null);
  const favoraveis = comScore.filter((l) => l.resultado.timing === "excelente" || l.resultado.timing === "bom").length;

  return (
    <Shell
      ativo="/tecnico"
      titulo="Técnico"
      subtitulo="O gráfico determina QUANDO, nunca O QUE comprar. Um gráfico bom nunca aprova uma empresa ruim — isto complementa Fundamentos, Carry e Compounders, nunca os substitui."
    >
      <div className="rounded-xl border border-sky-400/20 bg-sky-500/[0.05] px-4 py-2.5 text-[12px] text-slate-300">
        <span className="font-semibold text-sky-300">Technical Score v1</span> — corte honesto: só usa candles
        diários (histórico semanal/mensal próprio fica para v2), sem detecção de padrões gráficos nomeados
        (triângulos, OCO), sem backtest. Cada empresa mostra quantos dos 5 componentes entraram de verdade. O
        sistema NUNCA diz &ldquo;compre&rdquo; ou &ldquo;venda&rdquo; — só{" "}
        <em className="not-italic text-slate-200">Momento Favorável/Desfavorável</em> ou{" "}
        <em className="not-italic text-slate-200">Aguardar melhor ponto</em>. Metodologia completa:{" "}
        <Link href="#metodologia" className="underline hover:text-sky-200">
          aqui embaixo
        </Link>
        .
      </div>

      {comScore.length > 0 && (
        <p className="text-[11px] text-slate-500">
          {favoraveis} de {comScore.length} empresas com Technical Score calculado estão em momento favorável nesta
          leitura. Isso é sobre TIMING de leitura, não sinal de compra.
        </p>
      )}

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Ranking completo</h2>
          <p className="text-[10px] text-slate-600">calculado na hora · nunca recomendação de compra ou venda</p>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-slate-950/90 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                <th className="py-1.5 pr-2">Empresa</th>
                <th className="py-1.5 pr-2">Modelo</th>
                <th className="py-1.5 pr-2 text-right">Pregões</th>
                <th className="py-1.5 pr-2 text-right">Componentes</th>
                <th className="py-1.5 pr-2 text-right">Timing</th>
                <th className="py-1.5 text-right">Technical Score</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="py-1.5 pr-2">
                    <Link href={`/tecnico/${l.ticker}`} className="hover:underline">
                      <span className="font-mono font-semibold">{l.ticker}</span>
                      <span className="ml-2 text-slate-400">{l.nome}</span>
                    </Link>
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                      {l.modelo ? ROTULO_MODELO[l.modelo] : "—"}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-500">{l.resultado.barrasDisponiveis}</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-400">
                    {l.resultado.componentesDisponiveis}/{l.resultado.componentesTotal}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {l.resultado.timing ? (
                      <span className={`rounded-full border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${corTiming(l.resultado.timing)}`}>
                        {ROTULO_TIMING[l.resultado.timing]}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>
                  <td className={`py-1.5 text-right text-sm font-bold ${corScore(l.resultado.score)}`}>
                    {l.resultado.score ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p id="metodologia" className="mt-2 text-[10.5px] leading-snug text-slate-600">
          Score = média ponderada dos componentes com dado disponível (peso redistribuído entre eles). Pesos:
          Tendência 30% (MM9/MM21/MM72) · Momentum 25% (RSI+MACD+ROC) · Volume 15% (volume relativo + OBV) ·
          Estrutura 15% (topos/fundos) · Rompimentos 15% (suporte/resistência + confirmação de volume). ATR e
          Bollinger aparecem na página de cada empresa como informativos — ainda fora da nota. Documentação
          completa: roadmap/technical-engine-v1.md. Nada aqui é recomendação de compra ou venda.
        </p>
      </section>
    </Shell>
  );
}
