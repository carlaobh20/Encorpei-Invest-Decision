import type { Conviccao } from "./confluencia";

/**
 * SISTEMA DE CONVICÇÃO (Bloco 2, Sprint 2.5, Módulo "Sistema de Convicção"
 * — Simplicity Layer).
 *
 * Corte honesto, testado antes de codar: `Conviccao` (Foundation congelado,
 * `confluencia.ts`) já tem 4 níveis (alta/moderada/baixa/indefinida),
 * calculados por `classificarConviccao(score, coberturaFrac)`. A spec pede
 * 7 rótulos (Muito Fraca/Fraca/Neutra/Boa/Forte/Muito Forte/Convicção
 * Máxima). Este arquivo NÃO recalcula convicção — mapeia o `Conviccao`
 * já calculado + o `score` (0-100) + `componentesDisponiveis` já
 * calculados pros 7 rótulos, exatamente como `badgeStatus` (Empresas,
 * Sprint 2.2) já fez pro status da tese.
 *
 * "Convicção Máxima" — a spec exige que só apareça quando TODOS os
 * critérios da metodologia forem satisfeitos, e que seja rara. Critério
 * explícito (documentado, não implícito): `conviccao === "alta"` E
 * `score >= 95` E `componentesDisponiveis === totalComponentes` (nenhum
 * dos 4 componentes do Confluence faltando). É um AND estrito de 3
 * condições — deve ser raro por construção, não por sorte.
 */

export type NivelConviccaoExibicao = "muito_fraca" | "fraca" | "neutra" | "boa" | "forte" | "muito_forte" | "conviccao_maxima";

export const ROTULO_CONVICCAO_EXIBICAO: Record<NivelConviccaoExibicao, string> = {
  muito_fraca: "Muito Fraca",
  fraca: "Fraca",
  neutra: "Neutra",
  boa: "Boa",
  forte: "Forte",
  muito_forte: "Muito Forte",
  conviccao_maxima: "Convicção Máxima",
};

export type EntradaConviccaoExibicao = {
  conviccao: Conviccao;
  score: number | null;
  componentesDisponiveis: number;
  totalComponentes: number;
};

export function classificarConviccaoExibicao(e: EntradaConviccaoExibicao): NivelConviccaoExibicao {
  if (e.conviccao === "indefinida") return "neutra";

  if (e.conviccao === "alta") {
    if (e.score !== null && e.score >= 95 && e.componentesDisponiveis === e.totalComponentes) {
      return "conviccao_maxima";
    }
    if (e.score !== null && e.score >= 85) return "muito_forte";
    return "forte";
  }

  if (e.conviccao === "moderada") {
    if (e.score !== null && e.score >= 60) return "boa";
    return "neutra";
  }

  // baixa
  if (e.score !== null && e.score < 25) return "muito_fraca";
  return "fraca";
}
