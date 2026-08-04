import type { DataQualityScore } from "./truth-quality-score";

/**
 * QUALITY DASHBOARD (Bloco 2, Sprint 2.4, Módulo 10 — Truth Layer).
 *
 * Agrega o Data Quality Score (Módulo 5) de várias empresas em cobertura
 * geral e por setor. Função pura — quem chama já calculou o
 * `DataQualityScore` de cada empresa (auditoria.ts + truth-data-confidence
 * + truth-quality-score), este arquivo só soma/agrupa.
 */

export type EntradaDashboardEmpresa = {
  score: DataQualityScore;
  setor: string | null;
};

export type LinhaCoberturaSetor = {
  setor: string;
  empresas: number;
  scoreMedio: number;
};

export type ResumoQualityDashboard = {
  empresasTotal: number;
  scoreMedioGeral: number;
  confirmados: number;
  pendentes: number;
  semSetor: number;
  porSetor: LinhaCoberturaSetor[];
};

export function montarQualityDashboard(entradas: EntradaDashboardEmpresa[]): ResumoQualityDashboard {
  const empresasTotal = entradas.length;
  const scoreMedioGeral = empresasTotal === 0 ? 0 : Math.round(entradas.reduce((soma, e) => soma + e.score.score, 0) / empresasTotal);
  const confirmados = entradas.filter((e) => e.score.score >= 80).length;
  const pendentes = entradas.filter((e) => e.score.camposPendentes > 0).length;
  const semSetor = entradas.filter((e) => e.setor === null).length;

  const porSetorMap = new Map<string, { empresas: number; somaScore: number }>();
  for (const e of entradas) {
    if (e.setor === null) continue;
    const atual = porSetorMap.get(e.setor) ?? { empresas: 0, somaScore: 0 };
    atual.empresas += 1;
    atual.somaScore += e.score.score;
    porSetorMap.set(e.setor, atual);
  }
  const porSetor: LinhaCoberturaSetor[] = [...porSetorMap.entries()]
    .map(([setor, v]) => ({ setor, empresas: v.empresas, scoreMedio: Math.round(v.somaScore / v.empresas) }))
    .sort((a, b) => b.empresas - a.empresas);

  return { empresasTotal, scoreMedioGeral, confirmados, pendentes, semSetor, porSetor };
}
