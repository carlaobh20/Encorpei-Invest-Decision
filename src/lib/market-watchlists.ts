import { MARKET_SCAN_CONFIG as CFG } from "./market-scan-config";
import type { StatusDerivadoTese } from "./thesis-engine";
import type { ComparacaoSetorial } from "./dash-narrativa";

/**
 * WATCHLISTS AUTOMÁTICAS (Bloco 2, Sprint 2.10, Módulo 4).
 *
 * As 8 listas pedidas, cada uma composta sobre sinais que JÁ existem —
 * nenhum motor novo. Duas ressalvas honestas, registradas nos próprios
 * rótulos das listas:
 *  - "Empresas que melhoraram/pioraram" e "Turnarounds" usam o ÚNICO sinal
 *    de tendência real disponível hoje sem a migração 024 (ver Módulo 2):
 *    tendência de ROIC (mesmo limiar de memory-layer-resultados.ts) + o
 *    Status Derivado da Tese (`thesis-engine.ts`, já classifica
 *    "fortalecendo"/"enfraquecendo" a partir do próprio Foundation). Não é
 *    um "novo motor de tendência" — é o motor de Status Derivado já
 *    existente, só filtrado.
 *  - "Novos Compounders" na verdade lista "Compounders identificados hoje"
 *    (score ≥ piso) — rastrear quem é REALMENTE novo na lista (cruzou o
 *    piso ontem à noite) depende da mesma migração 024 que falta pro
 *    Change Detection: sem "ontem" pra comparar, chamar de "novo" seria
 *    fabricar. Documentado no rótulo, não escondido.
 */

export type ItemWatchlist = { ticker: string; motivo: string };

export type Watchlists = {
  melhoraram: ItemWatchlist[];
  pioraram: ItemWatchlist[];
  compoundersHoje: ItemWatchlist[];
  turnarounds: ItemWatchlist[];
  qualityGrowth: ItemWatchlist[];
  altaProtecaoInflacao: ItemWatchlist[];
  lideresSetor: ItemWatchlist[];
  smallCapsPromissoras: ItemWatchlist[];
};

export type EntradaWatchlist = {
  ticker: string;
  confluence: number | null;
  carry: number | null;
  quality: number | null;
  growth: number | null;
  compounderScore: number | null;
  marketCap: number | null;
  thesisStatus: StatusDerivadoTese | null;
  roicVariacaoRelativa: number | null; // null = sem comparação disponível
  comparacaoConfluenceSetor: ComparacaoSetorial;
};

function vazio(): Watchlists {
  return {
    melhoraram: [], pioraram: [], compoundersHoje: [], turnarounds: [],
    qualityGrowth: [], altaProtecaoInflacao: [], lideresSetor: [], smallCapsPromissoras: [],
  };
}

export function montarWatchlists(entradas: EntradaWatchlist[]): Watchlists {
  const w = vazio();

  for (const e of entradas) {
    const roicMelhorou = e.roicVariacaoRelativa !== null && e.roicVariacaoRelativa >= CFG.limiarVariacaoRelativa;
    const roicPiorou = e.roicVariacaoRelativa !== null && e.roicVariacaoRelativa <= -CFG.limiarVariacaoRelativa;
    const statusFortalecendo = e.thesisStatus === "fortalecendo";
    const statusEnfraquecendo = e.thesisStatus === "enfraquecendo" || e.thesisStatus === "quebrada" || e.thesisStatus === "invalida";

    if (roicMelhorou || statusFortalecendo) {
      w.melhoraram.push({ ticker: e.ticker, motivo: statusFortalecendo ? "Tese fortalecendo." : "ROIC em tendência de melhora." });
    }
    if (roicPiorou || statusEnfraquecendo) {
      w.pioraram.push({ ticker: e.ticker, motivo: statusEnfraquecendo ? `Tese ${e.thesisStatus}.` : "ROIC em tendência de piora." });
    }
    if (e.compounderScore !== null && e.compounderScore >= CFG.pisoCompounderScore) {
      w.compoundersHoje.push({ ticker: e.ticker, motivo: `Compounder Score ${e.compounderScore.toFixed(0)} hoje.` });
    }
    if (statusFortalecendo && roicMelhorou) {
      w.turnarounds.push({ ticker: e.ticker, motivo: "Tese fortalecendo com ROIC em recuperação." });
    }
    if (e.quality !== null && e.growth !== null && e.quality >= CFG.pisoQualityGrowth && e.growth >= CFG.pisoGrowthQualityGrowth) {
      w.qualityGrowth.push({ ticker: e.ticker, motivo: `Quality ${e.quality.toFixed(0)} e Growth ${e.growth.toFixed(0)}.` });
    }
    if (e.carry !== null && e.carry >= CFG.pisoCarryProtecaoInflacao) {
      w.altaProtecaoInflacao.push({ ticker: e.ticker, motivo: `Carry real de IPCA+${(e.carry * 100).toFixed(1)}%.` });
    }
    if (e.comparacaoConfluenceSetor === "acima") {
      w.lideresSetor.push({ ticker: e.ticker, motivo: "Confluence acima da média do setor hoje." });
    }
    if (
      e.marketCap !== null &&
      e.marketCap <= CFG.tetoMarketCapSmallCap &&
      e.confluence !== null &&
      e.confluence >= CFG.pisoConfluenceSmallCapPromissora
    ) {
      w.smallCapsPromissoras.push({ ticker: e.ticker, motivo: "Small cap com Confluence acima do piso." });
    }
  }

  return w;
}
