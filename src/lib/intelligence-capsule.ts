import type { InvestmentStory } from "./investment-story-narrativa";

/**
 * INTELLIGENCE CAPSULE (Bloco 2, Sprint 2.7, Investment Coach Layer).
 *
 * Estrutura fixa pedida pela spec: Resumo / Por que importa / Maior
 * oportunidade / Maior risco / Nível de confiança / Preciso agir? — pura
 * composição sobre campos que já existem, nenhum motor novo:
 *  - Resumo/Por que importa/Oportunidade/Risco: `InvestmentStory`
 *    (Explanation Engine, Sprint 2.2), zero reprocessamento.
 *  - Nível de confiança: reaproveita `Decision.fdie` (resumo de
 *    verificações do FDIE, já usado em `classificarUrgencia` e nos
 *    alertas desta mesma tela) em vez de recalcular o Data Quality Score
 *    inteiro do Truth Layer (que exigiria replicar a consulta de
 *    `/auditoria/verdade` aqui) — mesmo tipo de sinal, honesto sobre a
 *    diferença: aqui é "o FDIE encontrou problema nesta empresa hoje?",
 *    não a nota 0-100 agregada do Quality Dashboard.
 *  - Preciso agir?: reaproveita a urgência já classificada por
 *    `classificarUrgencia` (decisoes-prioritarias.ts) — "crítica"/"alta"
 *    viram `true`, o resto `false`. Nenhuma urgência nova é inventada
 *    aqui.
 */

export type NivelConfianca = "alta" | "media" | "baixa" | "indisponivel";

export type IntelligenceCapsule = {
  resumo: string;
  porQueImporta: string;
  maiorOportunidade: string;
  maiorRisco: string;
  nivelConfianca: NivelConfianca;
  precisoAgir: boolean;
  precisoAgirMotivo: string;
};

export type EntradaIntelligenceCapsule = {
  story: InvestmentStory;
  fdie: { ok: number; alerta: number; critico: number; total: number };
  urgencia: "critica" | "alta" | "media" | "baixa";
  motivoUrgencia: string;
};

/** Exportado para reuso por wealth-intelligence-capsule.ts (Sprint 2.8) — mesma régua, nível de carteira em vez de nível de empresa. */
export function nivelConfiancaDoFdie(fdie: { ok: number; alerta: number; critico: number; total: number }): NivelConfianca {
  if (fdie.total === 0) return "indisponivel";
  if (fdie.critico > 0) return "baixa";
  if (fdie.alerta > 0) return "media";
  return "alta";
}

export function montarIntelligenceCapsule(entrada: EntradaIntelligenceCapsule): IntelligenceCapsule {
  const { story, fdie, urgencia, motivoUrgencia } = entrada;
  return {
    resumo: story.quemE,
    porQueImporta: story.porQueInteressante,
    maiorOportunidade: story.principalCatalisador,
    maiorRisco: story.principalRisco,
    nivelConfianca: nivelConfiancaDoFdie(fdie),
    precisoAgir: urgencia === "critica" || urgencia === "alta",
    precisoAgirMotivo: motivoUrgencia,
  };
}
