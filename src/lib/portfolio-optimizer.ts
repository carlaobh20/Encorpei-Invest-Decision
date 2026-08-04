import { montarWealthHealth, type EntradaWealthHealth, type WealthHealth } from "./wealth-health";

/**
 * PORTFOLIO OPTIMIZER (Bloco 2, Sprint 2.9, Wealth Intelligence Layer —
 * Módulo 2).
 *
 * "Minha carteira é a melhor possível?" — responde com "Nota atual" vs
 * "Nota ideal" + gargalos, SEM criar motor novo: chama `montarWealthHealth`
 * (Sprint 2.8) DUAS VEZES — uma com os dados reais da carteira, outra com
 * um cenário hipotético — e mostra a diferença.
 *
 * Decisão de design (registrada, não óbvia): "nota ideal" aqui NÃO é
 * "carteira perfeita imaginária" (isso seria fabricar um número). É
 * especificamente "sua carteira atual, mas com Diversificação e Liquidez
 * no melhor patamar possível" — os dois únicos componentes do Wealth
 * Health que dependem de COMO você distribui o capital entre os ativos que
 * já tem, não de QUAIS ativos você tem. Confluence/Carry/Quality/Portfolio
 * Fit/Risco dependem da qualidade dos ativos escolhidos — não há como
 * "idealizá-los" sem inventar uma carteira hipotética diferente, então
 * ficam iguais no cenário ideal. Isso também casa com o Módulo 3 (Capital
 * Allocation): o gargalo que o Optimizer aponta (concentração/liquidez) é
 * exatamente o que o Capital Allocation tenta fechar via peso sugerido —
 * nunca escolha de qual empresa comprar.
 */

export type GargaloComponente = {
  chave: string;
  rotulo: string;
  pontosAtual: number | null;
  pontosIdeal: number | null;
  gap: number | null;
  peso: number;
  /** true = fechar este gargalo depende só de redistribuir peso entre ativos já possuídos (concentração/liquidez); false = depende da qualidade dos ativos (fora do escopo deste módulo) */
  acionavelPorRebalanceamento: boolean;
};

export type ResultadoPortfolioOptimizer = {
  atual: WealthHealth;
  ideal: WealthHealth;
  gargalos: GargaloComponente[];
  /** null quando atual ou ideal não têm score (sem dado suficiente) */
  diferencaScore: number | null;
};

const COMPONENTES_ACIONAVEIS = new Set(["concentracao", "liquidez"]);

export function montarPortfolioOptimizer(entradaAtual: EntradaWealthHealth): ResultadoPortfolioOptimizer {
  const atual = montarWealthHealth(entradaAtual);
  const ideal = montarWealthHealth({
    ...entradaAtual,
    concentracaoRotulo: "baixa",
    liquidezRotulo: entradaAtual.liquidezRotulo !== null ? "alta" : null,
  });

  const gargalos: GargaloComponente[] = atual.componentes.map((c) => {
    const idealComponente = ideal.componentes.find((i) => i.chave === c.chave) ?? c;
    const gap =
      c.pontos !== null && idealComponente.pontos !== null ? idealComponente.pontos - c.pontos : null;
    return {
      chave: c.chave,
      rotulo: c.rotulo,
      pontosAtual: c.pontos,
      pontosIdeal: idealComponente.pontos,
      gap,
      peso: c.peso,
      acionavelPorRebalanceamento: COMPONENTES_ACIONAVEIS.has(c.chave),
    };
  }).sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0));

  const diferencaScore = atual.score !== null && ideal.score !== null ? ideal.score - atual.score : null;

  return { atual, ideal, gargalos, diferencaScore };
}
