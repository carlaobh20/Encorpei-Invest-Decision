/**
 * MARKET SCAN — CONFIGURAÇÃO CENTRAL (Bloco 2, Sprint 2.10).
 *
 * A spec pede "todos os filtros configuráveis, nenhum valor fixo no
 * código". Interpretação honesta do que dá pra entregar nesta rodada:
 * TODO limiar usado pelo Market Scan Engine (Change Detection, Opportunity
 * Engine, Watchlists, Funil) vive AQUI, um único objeto nomeado e
 * documentado — nunca espalhado como número mágico dentro de cada função.
 * O que NÃO está pronto: configurabilidade em TEMPO DE EXECUÇÃO via banco/
 * interface (Carlos mudando um limiar sem reimplantar o código) — isso
 * exigiria uma tabela nova de configuração + tela de edição, registrado
 * como pendência (ver docs/market-scan-engine.md). Por ora, "configurável"
 * significa "num só lugar, nomeado, fácil de mudar e revisar" — mesma
 * disciplina de heurística editorial já aplicada em wealth-health.ts,
 * portfolio-risk.ts, erros-classicos.ts etc.
 */

export const MARKET_SCAN_CONFIG = {
  /** Change Detection — variação relativa mínima para considerar uma métrica "mudou" (mesmo piso já usado em memory-layer-resultados.ts para ROIC). */
  limiarVariacaoRelativa: 0.1,
  /** Change Detection — Carry v1 (carry_score, diário): delta absoluto mínimo em pontos percentuais para virar evento. */
  limiarDeltaCarryPP: 0.01,

  /** Opportunity Engine — piso de Confluence para entrar na fila de oportunidades (abaixo disso, nem "Oportunidade"). */
  pisoConfluenceOportunidade: 55,
  /** Opportunity Engine — bandas de Confluence que definem os 5 níveis (mínimos, inclusive). */
  bandasConfluence: { oportunidade: 55, boa: 65, forte: 75, rara: 85, excepcional: 93 },
  /** Opportunity Engine — Carry real mínimo (IPCA+X% a.a.) exigido, além da Confluence, para "Rara"/"Excepcional" — mesmo campo `Decision.carry` já resolvido pela escada de 5 níveis, nunca recalculado aqui. */
  carryMinimoRaroAA: 0.1,

  /** Watchlists — piso de Compounder Score para entrar na lista de Compounders. */
  pisoCompounderScore: 70,
  /** Watchlists — piso de Quality (Decision.quality) para "Quality Growth". */
  pisoQualityGrowth: 65,
  /** Watchlists — piso de Growth (Decision.growth) para "Quality Growth". */
  pisoGrowthQualityGrowth: 65,
  /** Watchlists — piso de Carry real para "Alta proteção contra inflação". */
  pisoCarryProtecaoInflacao: 0.08,
  /** Watchlists — teto de market cap (R$) para "Small Cap" — heurística B3, revisável. */
  tetoMarketCapSmallCap: 10_000_000_000,
  /** Watchlists — piso de Confluence para "Small Caps promissoras" (não é só ser pequena, precisa ter sinal). */
  pisoConfluenceSmallCapPromissora: 60,

  /** Funil — liquidez mínima (volume financeiro médio diário, R$) para passar da etapa "Universo" para "Liquidez". */
  liquidezMinimaReais: 500_000,
} as const;

export type MarketScanConfig = typeof MARKET_SCAN_CONFIG;
