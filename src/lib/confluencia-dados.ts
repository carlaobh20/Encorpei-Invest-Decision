import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularConfluencia, type ConfluenciaResultado } from "@/lib/confluencia";
import { calcularRadar, type LinhaRadar } from "@/lib/radar";
import { calcularCompounders, type LinhaCompounder } from "@/lib/compounder-dados";
import { calcularTechnicals, type LinhaTechnical } from "@/lib/technical-dados";
import { ROTULO_MODELO, type ModeloAnalise } from "@/lib/setores";

/**
 * Camada de fetch da Confluência — junta o que radar.ts, compounder-dados.ts
 * e technical-dados.ts já calculam, por ticker. Mesma separação usada nos
 * outros motores: cálculo puro e testável em confluencia.ts, fetch aqui.
 */

export type LinhaConfluencia = {
  ticker: string;
  nome: string;
  modelo: ModeloAnalise | null;
  resultado: ConfluenciaResultado;
};

export async function calcularConfluencias(sb: SupabaseClient): Promise<LinhaConfluencia[]> {
  const [radar, compounders, technicals] = await Promise.all([
    calcularRadar(sb),
    calcularCompounders(sb),
    calcularTechnicals(sb),
  ]);

  const radarPorTicker = new Map<string, LinhaRadar>(radar.map((l) => [l.ticker, l]));
  const compounderPorTicker = new Map<string, LinhaCompounder>(compounders.map((l) => [l.ticker, l]));
  const technicalPorTicker = new Map<string, LinhaTechnical>(technicals.map((l) => [l.ticker, l]));

  const tickers = new Set<string>([
    ...radarPorTicker.keys(),
    ...compounderPorTicker.keys(),
    ...technicalPorTicker.keys(),
  ]);

  const linhas: LinhaConfluencia[] = [];
  for (const ticker of tickers) {
    const r = radarPorTicker.get(ticker);
    const c = compounderPorTicker.get(ticker);
    const t = technicalPorTicker.get(ticker);
    const nome = r?.nome ?? c?.nome ?? t?.nome ?? ticker;
    const modelo = r?.modelo ?? c?.modelo ?? t?.modelo ?? null;

    const resultado = calcularConfluencia({
      fundamentosScore: r?.nota ?? null,
      fundamentosComponentes: r?.componentes ?? 0,
      carryReal: r?.carryReal ?? null,
      compounderScore: c?.resultado.score ?? null,
      technicalScore: t?.resultado.score ?? null,
    });

    linhas.push({ ticker, nome, modelo, resultado });
  }

  return linhas.sort((a, b) => (b.resultado.score ?? -1) - (a.resultado.score ?? -1));
}

export { ROTULO_MODELO };
