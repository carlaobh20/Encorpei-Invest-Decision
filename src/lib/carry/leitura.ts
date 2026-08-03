import type { DegrauCarry } from "./escada";

/**
 * LEITURA GROWTH × CASH — comentário automático, por regra, comparando os
 * níveis 2 e 3 da escada. Não é um nível novo nem um número novo: é a
 * interpretação de dois números que já existem, porque a distância entre
 * eles é o sinal mais direto de qualidade de lucro que o sistema tem hoje.
 *
 * Growth assume que o lucro retido reinveste ao ROIC de hoje (otimista,
 * depende de execução futura). Cash mede o caixa que JÁ sobrou depois do
 * capex (realista, fato consumado). Growth bem acima de Cash não é erro —
 * é a pergunta "esse lucro contábil está virando caixa na mesma proporção,
 * ou fica preso em capital de giro/recebíveis/investimento?".
 */
export type LeituraCarry = {
  direcao: "sustenta" | "atencao";
  texto: string;
} | null;

export function leituraGrowthVsCash(degraus: DegrauCarry[]): LeituraCarry {
  const growth = degraus[1]?.resultado?.carryReal ?? null;
  const cash = degraus[2]?.resultado?.carryReal ?? null;

  if (growth === null || cash === null) return null;

  if (growth > 0 && cash < growth * 0.5) {
    return {
      direcao: "atencao",
      texto:
        "Growth bem acima do Cash: o retorno sobre capital é alto no papel, mas ainda não virou caixa " +
        "na mesma proporção. Não é sinal de problema por si só — mas vale acompanhar se isso muda nos " +
        "próximos trimestres antes de confiar no número mais otimista.",
    };
  }

  if (cash >= growth) {
    return {
      direcao: "sustenta",
      texto: "Cash acompanha ou supera o Growth: o lucro contábil está convertendo em caixa de verdade, não só no papel.",
    };
  }

  return null;
}
