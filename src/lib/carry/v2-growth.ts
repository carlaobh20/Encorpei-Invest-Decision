import type { CarryCalculator, CarryEntrada, CarryResultado, FatorCarry } from "./types";
import { carryV1Piso } from "./v1-piso";

/**
 * CARRY v2 — "GROWTH" (piso + crescimento reinvestido).
 *
 * Fórmula (clássica de retorno esperado, 100% reproduzível):
 *   retenção  = 1 − (dividendos+JCP 12m ÷ lucro 12m)      [limitada a 0..1]
 *   carry     = (rendimento do lucro × payout)  ←  parte distribuída
 *             + (retenção × ROIC médio 4 tri)   ←  parte reinvestida
 *
 * Intuição leiga: do lucro que a empresa gera, a fatia distribuída rende o
 * yield de hoje; a fatia retida é reinvestida à taxa de retorno do capital
 * da própria empresa. Se ROIC > rendimento do lucro, reter cria valor — e
 * o Growth fica ACIMA do Floor; se ROIC baixo, fica abaixo (verdade dura).
 *
 * GATE DE HONESTIDADE: sem dividendos 12m lidos da DFC oficial, devolve
 * null com a pendência explícita — nunca estima payout no chute.
 */
export const carryV2Growth: CarryCalculator = {
  versao: 2,
  metodo: "growth (piso + retenção × ROIC; payout via DFC oficial)",

  calcular(e: CarryEntrada): CarryResultado {
    const base = carryV1Piso.calcular(e);
    if (base.carryReal === null) {
      return { ...base, versao: 2, metodo: carryV2Growth.metodo };
    }
    if (
      e.dividendosJcpLtm === null ||
      e.dividendosJcpLtm === undefined ||
      e.lucroLtm === null ||
      e.lucroLtm <= 0 ||
      e.roic4 === null
    ) {
      return {
        carryReal: null,
        confianca: "baixa",
        explicacao:
          "Nível Growth aguarda dados: dividendos pagos (fluxo de caixa oficial da CVM) e ROIC. " +
          "O robô diário já coleta a DFC — este nível acende sozinho quando o dado chegar. " +
          "Estimativa baseada em fundamentos — nunca retorno garantido.",
        fatores: [],
        versao: 2,
        metodo: carryV2Growth.metodo,
      };
    }

    const payoutBruto = Math.abs(e.dividendosJcpLtm) / e.lucroLtm;
    const payout = Math.min(Math.max(payoutBruto, 0), 1);
    const retencao = 1 - payout;
    const partYield = base.carryReal * payout;
    const partGrowth = retencao * e.roic4;
    const carryReal = partYield + partGrowth;

    const pct = (v: number) => `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
    const fatores: FatorCarry[] = [
      {
        direcao: partGrowth >= base.carryReal * retencao ? "sustenta" : "atencao",
        texto: `Retenção de ${pct(retencao)} do lucro reinvestida a ROIC de ${pct(e.roic4)} → contribui ${pct(partGrowth)} a.a.`,
      },
      {
        direcao: "sustenta",
        texto: `Payout de ${pct(payout)} distribui parte do rendimento do lucro → contribui ${pct(partYield)} a.a.`,
      },
      ...base.fatores.filter((f) => f.direcao === "atencao"),
    ];

    return {
      carryReal,
      confianca: base.confianca,
      explicacao:
        `Growth: IPCA + ${pct(carryReal)} a.a. = distribuição (${pct(partYield)}) + reinvestimento (${pct(partGrowth)}). ` +
        `Payout medido na DFC oficial; ROIC médio de 4 trimestres. Estimativa baseada nos fundamentos atuais — nunca retorno garantido.`,
      fatores,
      versao: 2,
      metodo: carryV2Growth.metodo,
    };
  },
};
