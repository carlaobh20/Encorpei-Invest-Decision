import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { consolidarCarteira, type Posicao } from "@/lib/carteira";
import { calcularRadar } from "@/lib/radar";
import { calcularCompounders } from "@/lib/compounder-dados";
import { calcularSaudeCarteira, type LinhaSaude } from "@/lib/portfolio-health";
import { ROTULO_MODELO } from "@/lib/setores";
import { ROTULO_SENSIBILIDADE } from "@/lib/compounder/sensibilidade-juros";

export const dynamic = "force-dynamic";

/**
 * PORTFOLIO HEALTH — PIC 01. Resposta pra "minha carteira está melhor ou
 * pior que o normal?" — visão de conjunto, nunca de uma empresa isolada.
 * Tudo aqui é derivado de motores que já existem (Radar/Carry/Compounder/
 * Sector Intelligence); nada novo é inventado. Onde não há cobertura
 * suficiente, o card mostra o motivo em vez de um número decorativo.
 */

const pct = (v: number | null, casas = 1) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;

const ROTULO_CONCENTRACAO: Record<string, string> = {
  baixa: "Baixa",
  moderada: "Moderada",
  alta: "Alta",
  muito_alta: "Muito alta",
};
const COR_CONCENTRACAO: Record<string, string> = {
  baixa: "text-emerald-300",
  moderada: "text-sky-300",
  alta: "text-amber-300",
  muito_alta: "text-red-300",
};

export default async function SaudeCarteira() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/saude-carteira" titulo="Saúde da Carteira">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const [{ data: posicoesRaw, error: erroPosicoes }, radarLinhas, compounderLinhas] = await Promise.all([
    supabase.from("posicoes").select("ticker, quantidade, preco_medio"),
    calcularRadar(supabase),
    calcularCompounders(supabase),
  ]);
  const posicoes = erroPosicoes ? null : ((posicoesRaw as Posicao[]) ?? []);

  if (!posicoes || posicoes.length === 0) {
    return (
      <Shell
        ativo="/saude-carteira"
        titulo="Saúde da Carteira"
        subtitulo="Diversificação, concentração e qualidade média — visão de conjunto, não de uma empresa isolada."
      >
        <p className="text-slate-500">
          {posicoes === null ? (
            "O módulo está pronto; falta aplicar a migração 014 no banco."
          ) : (
            <>
              Registre suas posições reais em{" "}
              <Link href="/carteira" className="text-sky-400 hover:underline">/carteira</Link> para habilitar
              esta página.
            </>
          )}
        </p>
      </Shell>
    );
  }

  const { data: precosRaw } = await supabase
    .from("precos_diarios")
    .select("ticker, data, fechamento")
    .in("ticker", posicoes.map((p) => p.ticker))
    .order("data", { ascending: false });
  const precoPorTicker = new Map<string, number>();
  for (const p of (precosRaw as { ticker: string; fechamento: number }[]) ?? []) {
    if (!precoPorTicker.has(p.ticker)) precoPorTicker.set(p.ticker, Number(p.fechamento));
  }

  const consolidado = consolidarCarteira(posicoes, precoPorTicker);
  const radarPorTicker = new Map(radarLinhas.map((l) => [l.ticker, l]));
  const compPorTicker = new Map(compounderLinhas.map((l) => [l.ticker, l]));

  const linhasSaude: LinhaSaude[] = consolidado.linhas
    .filter((l) => l.peso !== null)
    .map((l) => {
      const r = radarPorTicker.get(l.ticker);
      const c = compPorTicker.get(l.ticker);
      return {
        ticker: l.ticker,
        peso: l.peso as number,
        modelo: l.modelo ? ROTULO_MODELO[l.modelo] : null,
        carryReal: r?.carryReal ?? null,
        roic4: r?.roic4 ?? null,
        earningsYield: r?.ey ?? null,
        sensibilidadeSelic: c?.sensibilidadeSelic.categoria ?? null,
      };
    });

  if (linhasSaude.length === 0) {
    return (
      <Shell ativo="/saude-carteira" titulo="Saúde da Carteira">
        <p className="text-slate-500">
          Ainda falta preço atual para calcular o peso de alguma posição — sem isso não dá pra
          medir concentração honestamente.
        </p>
      </Shell>
    );
  }

  const saude = calcularSaudeCarteira(linhasSaude);

  return (
    <Shell
      ativo="/saude-carteira"
      titulo="Saúde da Carteira"
      subtitulo="Diversificação, concentração e qualidade média — visão de conjunto, não de uma empresa isolada."
      rolagem
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Concentração</h2>
          <p className={`mt-2 text-3xl font-bold ${COR_CONCENTRACAO[saude.concentracaoRotulo]}`}>
            {ROTULO_CONCENTRACAO[saude.concentracaoRotulo]}
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            índice HHI {saude.concentracaoHHI.toFixed(3)} · maior posição:{" "}
            {saude.maiorPosicao ? (
              <span className="font-mono text-slate-300">
                {saude.maiorPosicao.ticker} ({pct(saude.maiorPosicao.peso)})
              </span>
            ) : "—"}
          </p>
        </section>

        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Carry médio (ponderado)</h2>
          <p className="mt-2 text-3xl font-bold text-sky-200">
            {saude.carryMedioPonderado !== null
              ? `IPCA + ${(saude.carryMedioPonderado * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
              : "—"}
          </p>
          <p className="mt-1 text-[12px] text-slate-500">
            cobertura {saude.cobertura.carry}/{saude.cobertura.total} posições
          </p>
        </section>

        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Sensibilidade à Selic</h2>
          <p className="mt-2 text-3xl font-bold text-slate-100">
            {saude.sensibilidadeSelicMedia.categoria
              ? ROTULO_SENSIBILIDADE[saude.sensibilidadeSelicMedia.categoria]
              : "—"}
          </p>
          <p className="mt-1 text-[12px] leading-snug text-slate-500">{saude.sensibilidadeSelicMedia.explicacao}</p>
        </section>

        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">ROIC médio (ponderado)</h2>
          <p className="mt-2 text-3xl font-bold text-slate-100">{pct(saude.roicMedioPonderado)}</p>
          <p className="mt-1 text-[12px] text-slate-500">
            cobertura {saude.cobertura.roic}/{saude.cobertura.total} — bancos/seguradoras não entram (Sector
            Intelligence)
          </p>
        </section>

        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Valuation médio (rendimento do lucro)</h2>
          <p className="mt-2 text-3xl font-bold text-slate-100">{pct(saude.earningsYieldMedioPonderado)}</p>
          <p className="mt-1 text-[12px] text-slate-500">
            cobertura {saude.cobertura.valuation}/{saude.cobertura.total} · lucro 12m ÷ valor de mercado, ponderado
          </p>
        </section>

        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Posições</h2>
          <p className="mt-2 text-3xl font-bold text-slate-100">{saude.cobertura.total}</p>
          <p className="mt-1 text-[12px] text-slate-500">
            <Link href="/carteira" className="text-sky-400 hover:underline">ver carteira completa →</Link>
          </p>
        </section>
      </div>

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Diversificação por modelo de negócio</h2>
        <div className="mt-3 space-y-2">
          {saude.alocacaoPorModelo.map((a) => (
            <div key={a.rotulo} className="flex items-center gap-3">
              <span className="w-40 shrink-0 text-[12.5px] text-slate-300">{a.rotulo}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                <div className="h-full rounded-full bg-sky-500/60" style={{ width: `${Math.min(100, a.pct * 100)}%` }} />
              </div>
              <span className="w-14 shrink-0 text-right font-mono text-[12px] text-slate-400">{pct(a.pct)}</span>
            </div>
          ))}
        </div>
      </section>

      <p className="text-[10.5px] leading-snug text-slate-600">
        Não fabricamos "Liquidez" nem "Risco composto" ainda — exigiriam calibração honesta (volume médio real por
        papel, cobertura de juros) que ainda não fizemos. Preferimos mostrar menos do que a spec pediu a mostrar um
        número decorativo. Metodologia completa: src/lib/portfolio-health.ts.
      </p>
    </Shell>
  );
}
