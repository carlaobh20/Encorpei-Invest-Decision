import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { calcularCompounders } from "@/lib/compounder-dados";
import { ROTULO_MODELO } from "@/lib/setores";
import { ROTULO_SENSIBILIDADE } from "@/lib/compounder/sensibilidade-juros";

export const dynamic = "force-dynamic";

/**
 * COMPOUNDERS — categoria própria (nunca misturada com Value/Dividendos/
 * Carry). Responde: quem tem mais capacidade de MULTIPLICAR patrimônio,
 * não só crescer. Metodologia completa em roadmap/compounder-engine-v1.md.
 */

function corScore(n: number | null): string {
  if (n === null) return "text-slate-600";
  if (n >= 80) return "text-emerald-300";
  if (n >= 60) return "text-emerald-500";
  if (n >= 40) return "text-amber-400";
  return "text-red-400";
}

export default async function Compounders() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/compounders" titulo="Compounders">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const linhas = await calcularCompounders(supabase);
  const comScore = linhas.filter((l) => l.resultado.score !== null);
  const top = comScore.slice(0, 3);
  const selicQuedaFatores = linhas.filter(
    (l) => l.sensibilidadeSelic.categoria === "muito_alta" || l.sensibilidadeSelic.categoria === "alta"
  ).length;

  return (
    <Shell
      ativo="/compounders"
      titulo="Compounders"
      subtitulo="Categoria própria — nunca misturada com Value, Dividendos ou Carry. A pergunta aqui é multiplicar patrimônio por muitos anos, não render bem em 12 meses."
    >
      <div className="rounded-xl border border-sky-400/20 bg-sky-500/[0.05] px-4 py-2.5 text-[12px] text-slate-300">
        <span className="font-semibold text-sky-300">Compounder Score v1</span> — metodologia com corte honesto:
        o sistema só tem ~2 anos de DFP coletados, então &ldquo;crescimento&rdquo; aqui é de 1 ano, não CAGR de
        3/5/10 anos ainda. Gestão e Runway ficam sem nota (exigem curadoria manual). Cada empresa mostra quantos
        dos 8 componentes entraram de verdade — nunca um peso escondido no lugar de dado que falta. Detalhe
        completo: <Link href="#metodologia" className="underline hover:text-sky-200">metodologia</Link>.
      </div>

      {top.length > 0 && (
        <div className="flex gap-3">
          {top.map((c, i) => (
            <div key={c.ticker} className="flex-1 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] px-4 py-3">
              <p className="text-[10px] uppercase tracking-[0.25em] text-emerald-300/80">
                índice compounder — nº {i + 1}
              </p>
              <p className="mt-0.5 text-base font-bold">
                <span className="font-mono">{c.ticker}</span>{" "}
                <span className={corScore(c.resultado.score)}>{c.resultado.score}</span>
                <span className="ml-2 text-xs font-normal text-slate-400">{c.nome}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {c.resultado.componentesDisponiveis}/{c.resultado.componentesTotal} componentes · confiança{" "}
                {c.resultado.confianca}
                {c.sensibilidadeSelic.categoria && (
                  <> · sensibilidade à Selic: {ROTULO_SENSIBILIDADE[c.sensibilidadeSelic.categoria]}</>
                )}
              </p>
            </div>
          ))}
        </div>
      )}

      {selicQuedaFatores > 0 && (
        <p className="text-[11px] text-slate-500">
          {selicQuedaFatores} empresa(s) com sensibilidade alta/muito alta à Selic nesta leitura — vale ler o
          Focus (Macro) antes de priorizar estudo por aí. O sistema NÃO compra sozinho quando a Selic cai; só
          prioriza leitura (Decision Engine, ver roadmap/compounder-engine-v1.md).
        </p>
      )}

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Ranking completo</h2>
          <p className="text-[10px] text-slate-600">score calculado na hora · nunca recomendação de compra ou venda</p>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-slate-950/90 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                <th className="py-1.5 pr-2">Empresa</th>
                <th className="py-1.5 pr-2">Modelo</th>
                <th className="py-1.5 pr-2 text-right">Componentes</th>
                <th className="py-1.5 pr-2 text-right">Confiança</th>
                <th className="py-1.5 pr-2 text-right">Sensib. Selic</th>
                <th className="py-1.5 text-right">Compounder Score</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="py-1.5 pr-2">
                    <Link href={`/compounders/${l.ticker}`} className="hover:underline">
                      <span className="font-mono font-semibold">{l.ticker}</span>
                      <span className="ml-2 text-slate-400">{l.nome}</span>
                    </Link>
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                      {l.modelo ? ROTULO_MODELO[l.modelo] : "—"}
                    </span>
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-400">
                    {l.resultado.componentesDisponiveis}/{l.resultado.componentesTotal}
                  </td>
                  <td className="py-1.5 pr-2 text-right text-[11px] text-slate-500">{l.resultado.confianca}</td>
                  <td className="py-1.5 pr-2 text-right text-[11px] text-slate-400">
                    {l.sensibilidadeSelic.categoria ? ROTULO_SENSIBILIDADE[l.sensibilidadeSelic.categoria] : "—"}
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
          Score = média ponderada dos componentes com dado disponível (peso redistribuído entre eles — nunca um
          buraco disfarçado). Pesos da metodologia completa: Growth Quality 25% · ROIC 20% · Reinvestimento 15% ·
          FCF 15% · Margens 10% · Gestão 5% · Runway 5% · Diluição 5%. Sensibilidade à Selic é heurística v1
          (alavancagem + retenção + modelo de negócio) — nunca calibrada contra histórico real de preço.
          Documentação completa: roadmap/compounder-engine-v1.md. Nada aqui é recomendação de compra ou venda.
        </p>
      </section>
    </Shell>
  );
}
