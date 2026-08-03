import type { ModeloAnalise } from "../setores";

/**
 * SENSIBILIDADE À QUEDA DA SELIC — v1, heurística declarada.
 *
 * A especificação original pediu para NÃO usar só o setor. Esta v1 combina
 * três fatores reais (alavancagem, intensidade de reinvestimento, e só
 * DEPOIS o modelo de negócio como fator adicional, nunca único) — mas é
 * uma heurística, não uma medição: nunca foi calibrada contra o histórico
 * real de preço da ação vs. movimentos da Selic. Isso está escrito na tela
 * onde aparece, não só aqui.
 */

export type CategoriaSensibilidade = "muito_alta" | "alta" | "media" | "baixa" | "muito_baixa";

export const ROTULO_SENSIBILIDADE: Record<CategoriaSensibilidade, string> = {
  muito_alta: "Muito alta",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  muito_baixa: "Muito baixa",
};

const MODELOS_INTENSIVOS_CAPITAL: ModeloAnalise[] = ["shopping_imobiliario", "eletrica_utility", "construcao"];
const MODELOS_LEVES: ModeloAnalise[] = ["software", "holding_consumo"];

export function sensibilidadeJuros(input: {
  alavancagem: number | null; // dívida líquida / patrimônio
  retencao: number | null; // 1 - payout
  modelo: ModeloAnalise | null;
}): { categoria: CategoriaSensibilidade | null; pontos: number; explicacao: string } {
  const { alavancagem, retencao, modelo } = input;
  if (alavancagem === null && retencao === null) {
    return { categoria: null, pontos: 0, explicacao: "Sem alavancagem nem retenção de lucro calculáveis ainda." };
  }

  let pontos = 0;
  const razoes: string[] = [];

  if (alavancagem !== null) {
    if (alavancagem > 1.5) {
      pontos += 2;
      razoes.push(`alavancagem alta (dívida líquida ${(alavancagem * 100).toFixed(0)}% do patrimônio) — custo de dívida cai mais forte no resultado`);
    } else if (alavancagem > 0.8) {
      pontos += 1;
      razoes.push("alavancagem moderada");
    } else if (alavancagem <= 0.3) {
      pontos -= 1;
      razoes.push("alavancagem baixa ou caixa líquido — menos exposta ao custo de dívida");
    }
  }

  if (retencao !== null) {
    if (retencao > 0.7) {
      pontos += 1;
      razoes.push("reinveste a maior parte do lucro — financiamento de crescimento se beneficia de custo de capital menor");
    } else if (retencao < 0.3) {
      pontos -= 1;
      razoes.push("distribui a maior parte do lucro — menos dependente de novo financiamento");
    }
  }

  if (modelo && MODELOS_INTENSIVOS_CAPITAL.includes(modelo)) {
    pontos += 1;
    razoes.push(`modelo de negócio (${modelo}) tipicamente financiado a longo prazo — fator adicional, não único`);
  } else if (modelo && MODELOS_LEVES.includes(modelo)) {
    pontos -= 1;
    razoes.push(`modelo de negócio (${modelo}) pouco intensivo em capital`);
  }

  const categoria: CategoriaSensibilidade =
    pontos >= 3 ? "muito_alta" : pontos === 2 ? "alta" : pontos <= -2 ? "muito_baixa" : pontos === -1 ? "baixa" : "media";

  return { categoria, pontos, explicacao: razoes.join("; ") || "sem fatores fortes identificados" };
}
