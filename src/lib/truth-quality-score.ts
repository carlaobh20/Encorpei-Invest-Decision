import type { Estrelas } from "./truth-data-confidence";
import { resumoSeveridade, type Verificacao } from "./auditoria";

/**
 * DATA QUALITY SCORE (Bloco 2, Sprint 2.4, Módulo 5 — Truth Layer).
 *
 * Agrega os selos de Data Confidence (Módulo 1) de uma empresa num único
 * número 0-100 — igual espírito de `resumoSeveridade` (auditoria.ts), só
 * que na escala que a spec pediu pra este painel específico. Reaproveita
 * `resumoSeveridade`, não reimplementa a contagem de severidade do FDIE.
 *
 * `indicadoresDivergentes` fica sempre 0 — não é "não há divergência", é
 * "o Módulo 4 (Multi-Source Validation) não existe ainda pra medir isso"
 * (ver truth-missing-data.ts). Nunca reportar 0 divergências como se
 * fosse confirmação.
 */

export type EntradaQualityScore = {
  ticker: string;
  estrelasPorIndicador: Record<string, Estrelas>;
  verificacoesFdie: Verificacao[];
  ultimaAuditoria: string | null;
};

export type DataQualityScore = {
  ticker: string;
  score: number;
  ultimaAuditoria: string | null;
  indicadoresConfirmados: number;
  indicadoresDivergentes: number;
  camposPendentes: number;
  indicadoresEsperadosTotal: number;
};

const PENALIDADE_CRITICO = 15;
const PENALIDADE_ALERTA = 5;

export function calcularDataQualityScore(e: EntradaQualityScore, indicadoresEsperados: string[]): DataQualityScore {
  const entradas = Object.entries(e.estrelasPorIndicador);
  const mediaEstrelas = entradas.length > 0 ? entradas.reduce((soma, [, estrelas]) => soma + estrelas, 0) / entradas.length : 0;
  const resumoFdie = resumoSeveridade(e.verificacoesFdie);

  let score = (mediaEstrelas / 5) * 100;
  score -= resumoFdie.critico * PENALIDADE_CRITICO;
  score -= resumoFdie.alerta * PENALIDADE_ALERTA;
  score = Math.max(0, Math.min(100, Math.round(score)));

  return {
    ticker: e.ticker,
    score,
    ultimaAuditoria: e.ultimaAuditoria,
    indicadoresConfirmados: entradas.filter(([, estrelas]) => estrelas >= 4).length,
    indicadoresDivergentes: 0,
    camposPendentes: indicadoresEsperados.filter((i) => !(i in e.estrelasPorIndicador)).length,
    indicadoresEsperadosTotal: indicadoresEsperados.length,
  };
}
