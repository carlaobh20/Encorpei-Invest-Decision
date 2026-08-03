/**
 * CARTEIRA — consolidação PURA das posições reais.
 * Entra: posições registradas + preços + notas + status de tese.
 * Sai: valor, resultado, peso, alocação por modelo — tudo derivado, nada
 * inventado. Sharpe/alpha/drawdown ficam gateados até existir SÉRIE de
 * patrimônio (que começa a acumular quando as posições existirem).
 */

import { modeloDe, ROTULO_MODELO, type ModeloAnalise } from "./setores";

export type Posicao = { ticker: string; quantidade: number; preco_medio: number };

export type LinhaCarteira = {
  ticker: string;
  quantidade: number;
  precoMedio: number;
  precoAtual: number | null;
  valorInvestido: number;
  valorAtual: number | null;
  resultado: number | null;
  resultadoPct: number | null;
  peso: number | null; // % do valor atual total
  modelo: ModeloAnalise | null;
};

export type Consolidado = {
  linhas: LinhaCarteira[];
  valorInvestido: number;
  valorAtual: number | null; // null se faltar preço de alguma posição
  resultado: number | null;
  resultadoPct: number | null;
  alocacaoPorModelo: { rotulo: string; pct: number }[];
};

export function consolidarCarteira(
  posicoes: Posicao[],
  precoPorTicker: Map<string, number>
): Consolidado {
  const linhas: LinhaCarteira[] = posicoes.map((p) => {
    const precoAtual = precoPorTicker.get(p.ticker) ?? null;
    const valorInvestido = p.quantidade * p.preco_medio;
    const valorAtual = precoAtual !== null ? p.quantidade * precoAtual : null;
    const resultado = valorAtual !== null ? valorAtual - valorInvestido : null;
    return {
      ticker: p.ticker,
      quantidade: p.quantidade,
      precoMedio: p.preco_medio,
      precoAtual,
      valorInvestido,
      valorAtual,
      resultado,
      resultadoPct:
        resultado !== null && valorInvestido > 0 ? resultado / valorInvestido : null,
      peso: null, // preenchido abaixo
      modelo: modeloDe(p.ticker),
    };
  });

  const valorInvestido = linhas.reduce((a, l) => a + l.valorInvestido, 0);
  const todosComPreco = linhas.every((l) => l.valorAtual !== null);
  const valorAtual = todosComPreco
    ? linhas.reduce((a, l) => a + (l.valorAtual ?? 0), 0)
    : null;
  const resultado = valorAtual !== null ? valorAtual - valorInvestido : null;

  if (valorAtual !== null && valorAtual > 0) {
    for (const l of linhas) l.peso = (l.valorAtual ?? 0) / valorAtual;
  }

  const porModelo = new Map<string, number>();
  if (valorAtual !== null && valorAtual > 0) {
    for (const l of linhas) {
      const rot = l.modelo ? ROTULO_MODELO[l.modelo] : "Sem modelo";
      porModelo.set(rot, (porModelo.get(rot) ?? 0) + (l.valorAtual ?? 0) / valorAtual);
    }
  }

  return {
    linhas: linhas.sort((a, b) => (b.valorAtual ?? 0) - (a.valorAtual ?? 0)),
    valorInvestido,
    valorAtual,
    resultado,
    resultadoPct:
      resultado !== null && valorInvestido > 0 ? resultado / valorInvestido : null,
    alocacaoPorModelo: [...porModelo.entries()]
      .map(([rotulo, pct]) => ({ rotulo, pct }))
      .sort((a, b) => b.pct - a.pct),
  };
}

/** Nota média da carteira PONDERADA pelo peso — só com todas as notas presentes. */
export function notaPonderada(
  linhas: LinhaCarteira[],
  notaPorTicker: Map<string, number>
): number | null {
  if (linhas.length === 0) return null;
  let soma = 0;
  let pesoTotal = 0;
  for (const l of linhas) {
    const nota = notaPorTicker.get(l.ticker);
    if (nota === undefined || l.peso === null) return null;
    soma += nota * l.peso;
    pesoTotal += l.peso;
  }
  return pesoTotal > 0 ? soma / pesoTotal : null;
}
