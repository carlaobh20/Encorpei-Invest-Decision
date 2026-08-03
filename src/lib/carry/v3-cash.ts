import type { CarryCalculator, CarryEntrada, CarryResultado, FatorCarry } from "./types";
import { carryV1Piso } from "./v1-piso";

/**
 * CARRY v3 — "CASH" (piso conservador em caixa, não em lucro contábil).
 *
 * Fórmula (docs/carry-engine.md, nível 3):
 *   fcf_aprox = caixa_operacional_12m + capex_12m   (capex já vem NEGATIVO
 *               da DFC — somar o valor já com sinal é o mesmo que subtrair
 *               o gasto de capex do caixa operacional)
 *   carry_cash = fcf_aprox ÷ valor_de_mercado
 *
 * Por que importa: lucro contábil pode conter itens que nunca viram caixa
 * (provisões, equivalência patrimonial, itens não-recorrentes, receita
 * reconhecida antes do recebimento). Caixa operacional líquido de capex é
 * o que a empresa de fato GERA e pode devolver ao acionista ou reinvestir
 * — mais difícil de maquiar que o resultado contábil.
 *
 * GATE DE HONESTIDADE: sem caixa operacional e capex lidos da DFC oficial,
 * devolve null com a pendência explícita — nunca estima a partir do lucro.
 */
export const carryV3Cash: CarryCalculator = {
  versao: 3,
  metodo: "cash (caixa operacional líquido de capex ÷ valor de mercado; DFC oficial)",

  calcular(e: CarryEntrada): CarryResultado {
    if (
      e.caixaOperacionalLtm === null ||
      e.caixaOperacionalLtm === undefined ||
      e.capexLtm === null ||
      e.capexLtm === undefined ||
      e.marketCap === null ||
      e.marketCap <= 0
    ) {
      return {
        carryReal: null,
        confianca: "baixa",
        explicacao:
          "Nível Cash aguarda dados: caixa operacional e capex (fluxo de caixa oficial da CVM, 12 meses). " +
          "O robô diário já coleta a DFC — este nível acende sozinho quando o dado chegar. " +
          "Estimativa baseada em fundamentos — nunca retorno garantido.",
        fatores: [],
        versao: 3,
        metodo: carryV3Cash.metodo,
      };
    }

    const fcfAprox = e.caixaOperacionalLtm + e.capexLtm;
    const carryReal = fcfAprox / e.marketCap;

    const floor = carryV1Piso.calcular(e);
    const fatores: FatorCarry[] = [];

    if (e.ehFinanceira) {
      fatores.push({
        direcao: "atencao",
        texto:
          "Banco/seguradora — o caixa operacional mistura captação e aplicação financeira; " +
          "o carrego em caixa é menos comparável ao de empresas não financeiras.",
      });
    }

    if (carryReal < 0) {
      fatores.push({
        direcao: "atencao",
        texto: "Geração de caixa negativa no período — a operação está consumindo caixa, não gerando.",
      });
    } else if (floor.carryReal !== null) {
      if (carryReal < floor.carryReal * 0.7) {
        fatores.push({
          direcao: "atencao",
          texto: "Caixa gerado bem abaixo do lucro contábil — parte do lucro pode não estar virando caixa.",
        });
      } else if (carryReal > floor.carryReal * 1.1) {
        fatores.push({
          direcao: "sustenta",
          texto: "Caixa gerado acima do lucro contábil — sinal de qualidade do resultado, não de maquiagem.",
        });
      }
    }

    if (e.caixaOperacionalLtm > 0) {
      const intensidadeCapex = Math.abs(e.capexLtm) / e.caixaOperacionalLtm;
      if (intensidadeCapex > 0.6) {
        fatores.push({
          direcao: "atencao",
          texto: "Capex consome parcela grande do caixa operacional — sobra menos para dividendos e recompras.",
        });
      }
    }

    const pct = (carryReal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return {
      carryReal,
      confianca: e.ehFinanceira ? "baixa" : "media",
      explicacao:
        `Cash: IPCA + ${pct}% ao ano — caixa operacional líquido de capex (fluxo de caixa oficial da ` +
        `CVM, 12 meses) dividido pelo valor de mercado. Troca o lucro contábil pelo caixa que a empresa ` +
        `de fato gera. Estimativa baseada nos fundamentos atuais — nunca retorno garantido.`,
      fatores,
      versao: 3,
      metodo: carryV3Cash.metodo,
    };
  },
};
