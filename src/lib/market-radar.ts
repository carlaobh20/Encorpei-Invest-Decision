import type { MudancaEvento } from "./market-scan-change-detection";
import type { ResultadoOportunidade } from "./opportunity-engine";
import type { StatusDerivadoTese } from "./thesis-engine";

/**
 * MARKET RADAR (Bloco 2, Sprint 2.10, Módulo 5) — painel "hoje": só soma o
 * que os Módulos 2-4 já produziram, nenhum cálculo novo.
 */

export type PainelMarketRadar = {
  empresasMonitoradas: number;
  empresasAlteradas: number;
  novasOportunidades: number;
  tesesQuebradas: { ticker: string; status: StatusDerivadoTese }[];
  tesesFortalecidas: string[];
  eventosRelevantes: MudancaEvento[];
  geradoEm: string;
};

export function montarPainelMarketRadar(entrada: {
  universo: string[];
  mudancas: MudancaEvento[];
  oportunidades: ResultadoOportunidade[];
  statusPorTicker: Map<string, StatusDerivadoTese>;
  geradoEm: string;
}): PainelMarketRadar {
  const { universo, mudancas, oportunidades, statusPorTicker, geradoEm } = entrada;

  const mudancasDisponiveis = mudancas.filter((m) => m.disponivel);
  const tickersAlterados = new Set(mudancasDisponiveis.map((m) => m.ticker));

  const tesesQuebradas: { ticker: string; status: StatusDerivadoTese }[] = [];
  const tesesFortalecidas: string[] = [];
  for (const [ticker, status] of statusPorTicker.entries()) {
    if (status === "quebrada" || status === "invalida") tesesQuebradas.push({ ticker, status });
    if (status === "fortalecendo") tesesFortalecidas.push(ticker);
  }

  return {
    empresasMonitoradas: universo.length,
    empresasAlteradas: tickersAlterados.size,
    novasOportunidades: oportunidades.filter((o) => o.nivel !== null).length,
    tesesQuebradas,
    tesesFortalecidas,
    eventosRelevantes: mudancasDisponiveis
      .filter((m) => m.direcao === "piorou" || m.direcao === "melhorou")
      .slice(0, 20),
    geradoEm,
  };
}
