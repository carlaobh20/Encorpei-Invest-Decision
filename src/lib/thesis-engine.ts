import type { Decision } from "./decision-object";

/**
 * THESIS ENGINE (Foundation v4 — Módulo 1).
 *
 * DECISÃO ARQUITETURAL EXPLÍCITA: a tabela `teses` (migração 004) já
 * implementa "nunca sobrescrever, sempre versionar" (`versao` incrementa,
 * linha antiga preservada) e já tem `status`. Este módulo NÃO recria essas
 * colunas — ele é uma camada de LEITURA/DERIVAÇÃO em cima do que já existe:
 * `Thesis Score` reaproveita `Decision.confluence` (Módulo 1 do v3.1),
 * `Thesis Version`/`Thesis Age` vêm direto da linha de `teses`, e `Thesis
 * Status` (os 6 estados pedidos) é CALCULADO a partir do `status` real de 3
 * estados + a tendência (Thesis Strength Engine, Módulo 4) — nunca grava
 * nada, nunca substitui a coluna real.
 *
 * A estrutura qualitativa (premissas, evidências, riscos, catalisadores,
 * fatores negativos, objetivos, hipóteses) vive na tabela nova
 * `tese_estrutura` (migração 022, FK para `teses`), imutável pelo mesmo
 * padrão do resto do sistema.
 */

export type StatusTeseReal = "valida" | "em_revisao" | "quebrada";
export type StrengthDirecao = "mais_forte" | "mais_fraca" | "neutra";
export type StatusDerivadoTese = "construindo" | "confirmada" | "fortalecendo" | "enfraquecendo" | "quebrada" | "invalida";

export const ROTULO_STATUS_DERIVADO: Record<StatusDerivadoTese, string> = {
  construindo: "Construindo (tese nova, ainda sem histórico suficiente)",
  confirmada: "Confirmada (estável, sem sinal recente de mudança)",
  fortalecendo: "Fortalecendo",
  enfraquecendo: "Enfraquecendo",
  quebrada: "Quebrada",
  invalida: "Inválida (premissa original invalidada — marcação manual)",
};

/** Abaixo desta idade, o status derivado é "construindo" independente da tendência — cedo demais pra confirmar ou refutar. */
export const LIMIAR_TESE_NOVA_DIAS = 30;

export type EntradaStatusDerivado = {
  statusReal: StatusTeseReal;
  idadeDias: number;
  /** direção do Thesis Strength Engine (Módulo 4) — null quando ainda não há comparação possível */
  strengthDirecao: StrengthDirecao | null;
  /** quando statusReal === "em_revisao": direção do gatilho que mais recentemente disparou */
  ultimoGatilhoDirecao?: "positivo" | "negativo" | null;
  /**
   * SEMPRE um sinal explícito, humano — nunca inferido de dado. "Inválida"
   * significa que a premissa original da tese estava errada desde o
   * início (não que ela se deteriorou depois) — só um humano sabe dizer
   * isso, marcando um item de `tese_estrutura` (tipo: 'premissa') como
   * invalidado.
   */
  invalidadaManualmente?: boolean;
};

/** Deriva os 6 estados do status real (3 estados) + idade + tendência. Nunca escreve, só classifica. */
export function classificarStatusDerivado(entrada: EntradaStatusDerivado): StatusDerivadoTese {
  if (entrada.invalidadaManualmente) return "invalida";
  if (entrada.statusReal === "quebrada") return "quebrada";

  if (entrada.idadeDias < LIMIAR_TESE_NOVA_DIAS) return "construindo";

  if (entrada.statusReal === "em_revisao") {
    if (entrada.ultimoGatilhoDirecao === "positivo") return "fortalecendo";
    // negativo ou desconhecido: em_revisao existe pra sinalizar atenção — tratamento honesto é o lado cauteloso
    return "enfraquecendo";
  }

  // statusReal === "valida"
  if (entrada.strengthDirecao === "mais_forte") return "fortalecendo";
  if (entrada.strengthDirecao === "mais_fraca") return "enfraquecendo";
  return "confirmada"; // neutra ou sem dado de tendência ainda
}

/** Dias desde a criação da tese. `agora` é sempre injetado — função pura, testável. */
export function calcularIdadeTese(criadoEm: string, agora: string): number {
  const a = new Date(criadoEm).getTime();
  const b = new Date(agora).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

export type TipoEstruturaTese = "premissa" | "evidencia" | "risco" | "catalisador" | "fator_negativo" | "objetivo" | "hipotese";

export type ItemEstruturaTese = {
  tipo: TipoEstruturaTese;
  texto: string;
  evidenciaId: number | null;
  ativo: boolean;
};

export type PerfilTese = {
  ticker: string;
  thesisScore: number | null;
  thesisStrength: number | null;
  thesisAge: number;
  thesisVersion: number;
  thesisStatus: StatusDerivadoTese;
  premissas: ItemEstruturaTese[];
  evidencias: ItemEstruturaTese[];
  riscos: ItemEstruturaTese[];
  catalisadores: ItemEstruturaTese[];
  fatoresNegativos: ItemEstruturaTese[];
  objetivos: ItemEstruturaTese[];
  hipoteses: ItemEstruturaTese[];
};

export type EntradaPerfilTese = {
  decision: Decision;
  teseVersao: number;
  teseCriadoEm: string;
  agora: string;
  statusReal: StatusTeseReal;
  strengthDirecao: StrengthDirecao | null;
  /** delta numérico do Thesis Strength Engine (Módulo 4) — só exibido, nunca recalculado aqui */
  strengthDelta: number | null;
  ultimoGatilhoDirecao?: "positivo" | "negativo" | null;
  invalidadaManualmente?: boolean;
  estrutura: ItemEstruturaTese[];
};

function porTipo(estrutura: ItemEstruturaTese[], tipo: TipoEstruturaTese): ItemEstruturaTese[] {
  return estrutura.filter((e) => e.tipo === tipo && e.ativo);
}

/** Monta o perfil completo da tese — reaproveita Decision (Score) e a estrutura já persistida; não recalcula nada. */
export function montarPerfilTese(entrada: EntradaPerfilTese): PerfilTese {
  const idadeDias = calcularIdadeTese(entrada.teseCriadoEm, entrada.agora);
  const thesisStatus = classificarStatusDerivado({
    statusReal: entrada.statusReal,
    idadeDias,
    strengthDirecao: entrada.strengthDirecao,
    ultimoGatilhoDirecao: entrada.ultimoGatilhoDirecao,
    invalidadaManualmente: entrada.invalidadaManualmente,
  });

  return {
    ticker: entrada.decision.ticker,
    thesisScore: entrada.decision.confluence,
    thesisStrength: entrada.strengthDelta,
    thesisAge: idadeDias,
    thesisVersion: entrada.teseVersao,
    thesisStatus,
    premissas: porTipo(entrada.estrutura, "premissa"),
    evidencias: porTipo(entrada.estrutura, "evidencia"),
    riscos: porTipo(entrada.estrutura, "risco"),
    catalisadores: porTipo(entrada.estrutura, "catalisador"),
    fatoresNegativos: porTipo(entrada.estrutura, "fator_negativo"),
    objetivos: porTipo(entrada.estrutura, "objetivo"),
    hipoteses: porTipo(entrada.estrutura, "hipotese"),
  };
}
