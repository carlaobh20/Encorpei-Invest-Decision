/**
 * PERFORMANCE ATTRIBUTION (Bloco 2, Sprint 2.8, Wealth Operating System —
 * Seção 4).
 *
 * A spec pede contribuição de cada empresa pra Retorno/Volatilidade/Carry/
 * Inflação/Diversificação. 3 das 5 têm fonte real e barata hoje:
 *  - Retorno: `peso × resultadoPct` (LinhaCarteira, já calculado).
 *  - Carry/Inflação: o PRÓPRIO dicionário do sistema define Carry como "a
 *    proteção esperada do patrimônio acima da inflação" — não são 2
 *    números diferentes aqui, são o mesmo (`peso × carryReal`), mostrados
 *    juntos honestamente em vez de fabricar uma segunda métrica "inflação"
 *    que não existiria.
 *  - Diversificação: `HHI_com - HHI_sem` (remover a posição e recalcular
 *    a concentração do resto, renormalizando peso) — definição real de
 *    Herfindahl-Hirschman, não um número novo, só reaplicada por posição.
 *
 * Volatilidade FICA DE FORA — calcular contribuição real de uma posição
 * pra volatilidade da carteira exige série de retornos + matriz de
 * covariância entre todas as posições, que não existe hoje. Fabricar um
 * número de volatilidade sem esse motor seria o mesmo erro que
 * `wealth-engine.ts` já se recusa a cometer com `probabilidadeAtingirObjetivo`
 * — mesma disciplina aplicada aqui.
 */

export type EntradaContribuicaoPosicao = {
  ticker: string;
  peso: number; // 0-1
  resultadoPct: number | null;
  carryReal: number | null;
};

export type ContribuicaoPosicao = {
  ticker: string;
  peso: number;
  contribuicaoRetorno: number | null;
  contribuicaoCarry: number | null;
  /**
   * `HHI_com - HHI_sem` (HHI = índice Herfindahl-Hirschman, portfolio-health.ts).
   * Positivo = a posição pesa mais que uma fatia "justa" das demais — removê-la
   * DEIXA a carteira menos concentrada (mais diversificada). Negativo = o
   * oposto: com poucas posições restantes, removê-la concentra o que sobra
   * em menos nomes (a carteira fica MAIS concentrada sem ela).
   */
  impactoConcentracao: number;
};

export type ResultadoAttribution = {
  posicoes: ContribuicaoPosicao[];
  avisoVolatilidade: string;
};

const AVISO_VOLATILIDADE =
  "Contribuição para volatilidade não é calculada — exigiria série de retornos e matriz de covariância entre as posições, motor que não existe hoje. Mostrar um número aqui sem esse motor seria uma projeção fabricada.";

function hhi(pesos: number[]): number {
  return pesos.reduce((a, p) => a + p * p, 0);
}

export function montarPortfolioAttribution(entradas: EntradaContribuicaoPosicao[]): ResultadoAttribution {
  const pesoTotal = entradas.reduce((a, e) => a + e.peso, 0);
  const hhiCom = hhi(entradas.map((e) => e.peso));

  const posicoes: ContribuicaoPosicao[] = entradas.map((e) => {
    const restante = entradas.filter((o) => o.ticker !== e.ticker);
    const pesoRestante = pesoTotal - e.peso;
    const hhiSem =
      pesoRestante > 0 ? hhi(restante.map((o) => o.peso / pesoRestante)) : 0;

    return {
      ticker: e.ticker,
      peso: e.peso,
      contribuicaoRetorno: e.resultadoPct !== null ? e.peso * e.resultadoPct : null,
      contribuicaoCarry: e.carryReal !== null ? e.peso * e.carryReal : null,
      impactoConcentracao: hhiCom - hhiSem,
    };
  });

  return { posicoes, avisoVolatilidade: AVISO_VOLATILIDADE };
}
