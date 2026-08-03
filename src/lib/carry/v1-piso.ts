import {
  CARRY_CONFIG,
  type CarryCalculator,
  type CarryEntrada,
  type CarryResultado,
  type FatorCarry,
} from "./types";

/**
 * CARRY v1 — "PISO CONSERVADOR".
 *
 * Metodologia: carry real = rendimento do lucro (lucro 12m ÷ valor de
 * mercado). Por que isso aproxima "IPCA + X%": lucros de empresas tendem a
 * acompanhar a inflação (repassam preços), então o rendimento do lucro é
 * uma estimativa do retorno REAL de longo prazo NUM CENÁRIO SEM
 * CRESCIMENTO — por isso "piso". Crescimento real reinvestido entra na v2,
 * quando o pipeline ler dividendos/payout (retenção × ROIC).
 *
 * O número é OBSERVADO (dois dados oficiais divididos), não modelado.
 * Os 5 motores conceituais (rentabilidade, caixa, reinvestimento,
 * valuation, risco) aparecem como FATORES que sustentam ou ameaçam o
 * carrego — nunca como multiplicadores inventados.
 */
export const carryV1Piso: CarryCalculator = {
  versao: 1,
  metodo: "piso-conservador (rendimento real do lucro, sem crescimento)",

  calcular(e: CarryEntrada): CarryResultado {
    const L = CARRY_CONFIG.limiares;
    const fatores: FatorCarry[] = [];

    // ---------- o número ----------
    const carryReal =
      e.lucroLtm !== null && e.lucroLtm > 0 && e.marketCap !== null && e.marketCap > 0
        ? e.lucroLtm / e.marketCap
        : null;

    if (carryReal === null) {
      return {
        carryReal: null,
        confianca: "baixa",
        explicacao:
          e.lucroLtm !== null && e.lucroLtm <= 0
            ? "Sem carrego calculável: a empresa não teve lucro nos últimos 12 meses — não há retorno de lucro para carregar."
            : "Sem carrego calculável: falta lucro de 12 meses fechado ou valor de mercado — o sistema não estima no chute.",
        fatores,
        versao: 1,
        metodo: carryV1Piso.metodo,
      };
    }

    // ---------- motores como fatores ----------
    // Motor rentabilidade
    if (e.roic4 !== null && e.roic4 >= L.roicAlto) {
      fatores.push({
        direcao: "sustenta",
        texto: "Retorno sobre o capital alto — o lucro tende a se recompor e crescer com os reinvestimentos.",
      });
    }
    // Motor risco: balanço
    if (e.caixaLiquido === true) {
      fatores.push({
        direcao: "sustenta",
        texto: "Caixa líquido — o carrego não é consumido por juros de dívida.",
      });
    } else if (e.alavancagem !== null && e.alavancagem > L.alavancagemAlta) {
      fatores.push({
        direcao: "atencao",
        texto: "Dívida maior que o patrimônio — juros competem com o acionista pelo lucro.",
      });
    }
    // Motor previsibilidade
    if (e.margensDesvio !== null && e.margensDesvio <= L.margemEstavel) {
      fatores.push({
        direcao: "sustenta",
        texto: "Margens estáveis — o lucro que sustenta o carrego é previsível.",
      });
    } else if (e.margensDesvio !== null && e.margensDesvio > L.margemInstavel) {
      fatores.push({
        direcao: "atencao",
        texto: "Margens oscilantes — o lucro dos últimos 12 meses pode não se repetir.",
      });
    }
    // Motor crescimento (2025 vs 2024 — série oficial começa em 2024)
    if (e.crescReceitaAnual !== null && e.crescReceitaAnual >= L.crescimentoBom) {
      fatores.push({
        direcao: "sustenta",
        texto: "Receita cresceu no último ano — o piso tende a subestimar o carrego real.",
      });
    } else if (e.crescReceitaAnual !== null && e.crescReceitaAnual < 0) {
      fatores.push({
        direcao: "atencao",
        texto: "Receita encolheu no último ano — o lucro que sustenta o carrego está sob pressão.",
      });
    }
    // Motor valuation (o preço é parte do carrego por construção)
    if (carryReal < L.precoExigente) {
      fatores.push({
        direcao: "atencao",
        texto: "Preço exigente — pagar caro reduz o carrego, por melhor que a empresa seja.",
      });
    }
    if (e.ehFinanceira) {
      fatores.push({
        direcao: "atencao",
        texto: "Banco/seguradora — ROIC e dívida não se aplicam ao modelo; o carrego considera só lucro e preço.",
      });
    }

    // ---------- confiança ----------
    const insumos = [e.roic4, e.margensDesvio, e.alavancagem, e.crescReceitaAnual].filter(
      (x) => x !== null
    ).length;
    const confianca: CarryResultado["confianca"] =
      e.ehFinanceira || insumos <= 1 ? "baixa" : insumos >= 3 ? "alta" : "media";

    const pct = (carryReal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    return {
      carryReal,
      confianca,
      explicacao:
        `Estimativa de piso: aos preços de hoje, o lucro dos últimos 12 meses rende IPCA + ${pct}% ao ano ` +
        `num cenário SEM crescimento. É estimativa baseada nos fundamentos atuais — nunca retorno garantido.`,
      fatores,
      versao: 1,
      metodo: carryV1Piso.metodo,
    };
  },
};
