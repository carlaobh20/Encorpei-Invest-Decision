import { detectarMudancaConfluence, LIMIARES_TIMELINE } from "./decision-timeline";
import type { Decision } from "./decision-object";
import type { StrengthDirecao } from "./thesis-engine";

/**
 * THESIS STRENGTH ENGINE (Foundation v4 — Módulo 4).
 *
 * "A cada publicação, a tese ficou mais forte, mais fraca ou neutra? Mostrar
 * o Strength Delta, nunca só o score" — isso é EXATAMENTE o que
 * `detectarMudancaConfluence` (Decision Timeline, Bloco 1) já faz: compara
 * dois snapshots de Confluence e decide se a variação é grande o bastante
 * pra contar como evento. Este módulo reaproveita essa função em vez de
 * duplicar o limiar/a lógica — só traduz o resultado para o vocabulário do
 * Thesis Engine (mais_forte/mais_fraca/neutra) e alimenta
 * `classificarStatusDerivado` (Módulo 1).
 */

export type ResultadoStrengthDelta = {
  direcao: StrengthDirecao;
  /** pontos de Confluence (mesma escala 0-100); null quando não há os dois snapshots pra comparar */
  delta: number | null;
  motivo: string;
};

/** Compara dois valores de Confluence já calculados — nunca recalcula Confluence aqui. */
export function calcularStrengthDelta(ticker: string, confluenceAnterior: number | null, confluenceAtual: number | null): ResultadoStrengthDelta {
  if (confluenceAnterior === null || confluenceAtual === null) {
    return {
      direcao: "neutra",
      delta: null,
      motivo: "Sem os dois snapshots de Confluence necessários para comparar — falta histórico suficiente ainda.",
    };
  }

  const evento = detectarMudancaConfluence(ticker, confluenceAnterior, confluenceAtual);
  const diffBruto = confluenceAtual - confluenceAnterior;

  if (!evento) {
    return {
      direcao: "neutra",
      delta: diffBruto,
      motivo: `Confluence variou ${diffBruto >= 0 ? "+" : ""}${diffBruto} pontos — abaixo do limiar de ${LIMIARES_TIMELINE.confluence} pontos usado pela Decision Timeline, tratado como estável.`,
    };
  }

  const diff = evento.detalhe.diff as number;
  return {
    direcao: diff > 0 ? "mais_forte" : "mais_fraca",
    delta: diff,
    motivo: evento.explicacao,
  };
}

/** Conveniência: extrai o ticker e o Confluence de dois Decision Objects já montados. */
export function calcularStrengthDeltaEntreDecisions(anterior: Decision, atual: Decision): ResultadoStrengthDelta {
  return calcularStrengthDelta(atual.ticker, anterior.confluence, atual.confluence);
}
