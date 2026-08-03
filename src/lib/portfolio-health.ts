/**
 * PORTFOLIO HEALTH — PIC 01 (03/08/2026).
 *
 * "Minha carteira está melhor ou pior que o normal?" — visão agregada da
 * carteira, não de uma empresa isolada. Tudo aqui é derivado de dado que o
 * sistema já calcula por ticker (Radar, Carry, Compounder, Sector
 * Intelligence); nenhuma métrica nova é inventada. Onde não há dado
 * honesto (ex.: liquidez de todos os papéis, cobertura de juros), o campo
 * fica null com o motivo — nunca um número decorativo.
 */

import type { CategoriaSensibilidade } from "./compounder/sensibilidade-juros";

export type LinhaSaude = {
  ticker: string;
  peso: number; // 0-1, sobre o valor atual da carteira
  modelo: string | null;
  carryReal: number | null;
  roic4: number | null;
  earningsYield: number | null; // lucro ÷ preço — usado pra "valuation médio"
  sensibilidadeSelic: CategoriaSensibilidade | null;
};

export type ConcentracaoRotulo = "baixa" | "moderada" | "alta" | "muito_alta";

export type SaudeCarteira = {
  /** índice Herfindahl-Hirschman (soma dos pesos²) — 1/N se igualmente distribuída */
  concentracaoHHI: number;
  concentracaoRotulo: ConcentracaoRotulo;
  maiorPosicao: { ticker: string; peso: number } | null;
  alocacaoPorModelo: { rotulo: string; pct: number }[];
  carryMedioPonderado: number | null;
  roicMedioPonderado: number | null;
  earningsYieldMedioPonderado: number | null;
  sensibilidadeSelicMedia: { categoria: CategoriaSensibilidade | null; explicacao: string };
  /** quantas posições entraram em cada métrica — corte honesto sobre cobertura */
  cobertura: { carry: number; roic: number; valuation: number; sensibilidade: number; total: number };
};

const ROTULO_MODELO_FALLBACK = "Sem modelo";

const PONTOS_SENSIBILIDADE: Record<CategoriaSensibilidade, number> = {
  muito_baixa: -2,
  baixa: -1,
  media: 0,
  alta: 1,
  muito_alta: 2,
};

function rotularConcentracao(hhi: number): ConcentracaoRotulo {
  // referência de mercado: HHI < 0.15 = pouco concentrado, > 0.25 = muito
  if (hhi < 0.15) return "baixa";
  if (hhi < 0.25) return "moderada";
  if (hhi < 0.4) return "alta";
  return "muito_alta";
}

function mediaPonderada(itens: { peso: number; valor: number | null }[]): { valor: number | null; n: number } {
  const disponiveis = itens.filter((i) => i.valor !== null) as { peso: number; valor: number }[];
  if (disponiveis.length === 0) return { valor: null, n: 0 };
  const pesoTotal = disponiveis.reduce((a, i) => a + i.peso, 0);
  if (pesoTotal <= 0) return { valor: null, n: 0 };
  const soma = disponiveis.reduce((a, i) => a + i.valor * i.peso, 0);
  return { valor: soma / pesoTotal, n: disponiveis.length };
}

export function calcularSaudeCarteira(linhas: LinhaSaude[]): SaudeCarteira {
  const total = linhas.length;
  const concentracaoHHI = linhas.reduce((a, l) => a + l.peso ** 2, 0);
  const maior = [...linhas].sort((a, b) => b.peso - a.peso)[0] ?? null;

  const porModelo = new Map<string, number>();
  for (const l of linhas) {
    const rot = l.modelo ?? ROTULO_MODELO_FALLBACK;
    porModelo.set(rot, (porModelo.get(rot) ?? 0) + l.peso);
  }

  const carry = mediaPonderada(linhas.map((l) => ({ peso: l.peso, valor: l.carryReal })));
  const roic = mediaPonderada(linhas.map((l) => ({ peso: l.peso, valor: l.roic4 })));
  const valuation = mediaPonderada(linhas.map((l) => ({ peso: l.peso, valor: l.earningsYield })));

  const sensibilidade = mediaPonderada(
    linhas.map((l) => ({
      peso: l.peso,
      valor: l.sensibilidadeSelic ? PONTOS_SENSIBILIDADE[l.sensibilidadeSelic] : null,
    }))
  );
  let categoriaSens: CategoriaSensibilidade | null = null;
  if (sensibilidade.valor !== null) {
    const p = sensibilidade.valor;
    categoriaSens = p >= 1.5 ? "muito_alta" : p >= 0.5 ? "alta" : p <= -1.5 ? "muito_baixa" : p <= -0.5 ? "baixa" : "media";
  }

  return {
    concentracaoHHI,
    concentracaoRotulo: rotularConcentracao(concentracaoHHI),
    maiorPosicao: maior ? { ticker: maior.ticker, peso: maior.peso } : null,
    alocacaoPorModelo: [...porModelo.entries()]
      .map(([rotulo, pct]) => ({ rotulo, pct }))
      .sort((a, b) => b.pct - a.pct),
    carryMedioPonderado: carry.valor,
    roicMedioPonderado: roic.valor,
    earningsYieldMedioPonderado: valuation.valor,
    sensibilidadeSelicMedia: {
      categoria: categoriaSens,
      explicacao:
        categoriaSens === null
          ? "Sem dado de alavancagem/reinvestimento suficiente na carteira para estimar."
          : `Ponderada por peso na carteira, cobrindo ${sensibilidade.n} de ${total} posições.`,
    },
    cobertura: { carry: carry.n, roic: roic.n, valuation: valuation.n, sensibilidade: sensibilidade.n, total },
  };
}
