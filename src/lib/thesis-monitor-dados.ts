import { detectarMudancaNota, LIMIARES_TIMELINE } from "./decision-timeline";

/**
 * THESIS MONITOR (Bloco 2 — Sprint 2.1, Decision Center, Seção 4).
 *
 * SUBSTITUIÇÃO HONESTA registrada com o Carlos antes de codar: a spec pede
 * Strength ↑/↓ (Thesis Strength Engine, Módulo 4), que precisa de DOIS
 * Decision Objects no tempo (`confluenceAnterior` vs `confluenceAtual`) — o
 * sistema não persiste snapshots de Decision Object ainda (só a nota
 * oficial diária em `scores`, que é outro motor). Em vez de fabricar uma
 * tendência de Confluence que não existe, este arquivo usa a ÚNICA série
 * histórica real e diária que o sistema tem — a nota oficial (`scores`,
 * motor `calcularScorePorModelo`) — e reaproveita `detectarMudancaNota`
 * (já testado, Foundation v3, `decision-timeline.ts`) para decidir se a
 * mudança é grande o bastante pra virar sinal. Rotulado na UI como "nota
 * oficial", nunca como "Confluence", para não confundir os dois motores.
 *
 * Função pura — quem chama já buscou os dois pontos mais recentes de
 * `scores` por ticker (mesmo padrão de `dash-agregados.ts`).
 */

export type TendenciaNota = "subindo" | "descendo" | "estavel";

export const ROTULO_TENDENCIA: Record<TendenciaNota, string> = {
  subindo: "↑",
  descendo: "↓",
  estavel: "≈",
};

export type EntradaThesisMonitor = {
  ticker: string;
  empresa: string;
  notaAnterior: number | null;
  notaAtual: number | null;
};

export type LinhaThesisMonitor = {
  ticker: string;
  empresa: string;
  notaAnterior: number;
  notaAtual: number;
  diff: number;
  tendencia: TendenciaNota;
  explicacao: string;
};

/**
 * Classifica a tendência de UM ticker (subindo/descendo/estável), SEMPRE
 * retorna algo — diferente de `montarThesisMonitor` (que só lista quem
 * mudou), esta função serve telas de empresa única (Sprint 2.2), onde
 * "sem mudança" também é uma resposta válida a mostrar, não um item a
 * esconder. `null` quando falta um dos dois pontos — nunca inventa
 * tendência.
 */
export function classificarTendenciaNota(notaAnterior: number | null, notaAtual: number | null, limiar: number = LIMIARES_TIMELINE.nota): TendenciaNota | null {
  if (notaAnterior === null || notaAtual === null) return null;
  const diff = notaAtual - notaAnterior;
  if (Math.abs(diff) < limiar) return "estavel";
  return diff > 0 ? "subindo" : "descendo";
}

/**
 * Só entram tickers cuja nota oficial mudou o suficiente (limiar de
 * `decision-timeline.ts`, mesma régua da Timeline do Meu Dash) — a spec
 * pede explicitamente "só as empresas cuja tese mudou", nunca a lista
 * inteira.
 */
export function montarThesisMonitor(entradas: EntradaThesisMonitor[], limiar: number = LIMIARES_TIMELINE.nota): LinhaThesisMonitor[] {
  const linhas: LinhaThesisMonitor[] = [];
  for (const e of entradas) {
    const evento = detectarMudancaNota(e.ticker, e.notaAnterior, e.notaAtual, limiar);
    if (!evento || e.notaAnterior === null || e.notaAtual === null) continue;
    const diff = e.notaAtual - e.notaAnterior;
    linhas.push({
      ticker: e.ticker,
      empresa: e.empresa,
      notaAnterior: e.notaAnterior,
      notaAtual: e.notaAtual,
      diff,
      tendencia: diff > 0 ? "subindo" : "descendo",
      explicacao: `${evento.explicacao} (nota oficial — motor de score, não Confluence).`,
    });
  }
  return linhas.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));
}
