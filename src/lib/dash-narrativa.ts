/**
 * DASH NARRATIVA (Bloco 2 — Sprint 2.1, Meu Dash).
 *
 * A spec proíbe indicador solto sem contexto ("Carry: 11,8%" é proibido;
 * "Carry IPCA+11,8%, acima da média do setor hoje" é o pedido). Corte
 * honesto sobre a palavra "histórica" que o exemplo da spec usa: o sistema
 * NÃO guarda série histórica de Carry por setor — comparar contra uma
 * "média histórica" seria inventar um número que não existe. O comparador
 * real e disponível hoje é a média TRANSVERSAL (cross-sectional): entre as
 * empresas do MESMO setor, hoje, qual a média? Esse é o número que estas
 * funções produzem — a frase sempre diz "hoje", nunca "histórica", porque
 * é isso que está sendo medido.
 */

export type ComparacaoSetorial = "acima" | "abaixo" | "na_media" | "indisponivel";

/** Diferença mínima (em pontos percentuais/pontos) para não tratar como "na média" — evita "acima" por 0,01pp. */
const EPSILON_COMPARACAO = 0.005;

export function compararComSetor(valor: number | null, mediaSetor: number | null): ComparacaoSetorial {
  if (valor === null || mediaSetor === null) return "indisponivel";
  const diff = valor - mediaSetor;
  if (Math.abs(diff) < EPSILON_COMPARACAO) return "na_media";
  return diff > 0 ? "acima" : "abaixo";
}

/**
 * Média transversal de um campo numérico entre linhas do MESMO setor,
 * excluindo o próprio ticker. Função genérica — reaproveitada tanto para
 * Carry quanto para Confluence, nunca duplicada por campo.
 */
export function mediaSetor<T extends { ticker: string; setor: string | null }>(
  tickerAlvo: string,
  setorAlvo: string | null,
  linhas: T[],
  valorDe: (l: T) => number | null
): number | null {
  if (setorAlvo === null) return null;
  const pares = linhas
    .filter((l) => l.ticker !== tickerAlvo && l.setor === setorAlvo)
    .map(valorDe)
    .filter((v): v is number => v !== null);
  if (pares.length === 0) return null;
  return pares.reduce((a, b) => a + b, 0) / pares.length;
}

export function fraseCarryComContexto(carryReal: number | null, comparacao: ComparacaoSetorial): string {
  if (carryReal === null) return "Carry indisponível para esta empresa.";
  const valorTxt = `IPCA+${(carryReal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  switch (comparacao) {
    case "acima":
      return `Carry ${valorTxt}, acima da média do setor hoje.`;
    case "abaixo":
      return `Carry ${valorTxt}, abaixo da média do setor hoje.`;
    case "na_media":
      return `Carry ${valorTxt}, na média do setor hoje.`;
    case "indisponivel":
      return `Carry ${valorTxt} — sem média setorial calculável para comparar hoje.`;
  }
}

export function fraseConfluenceComContexto(score: number | null, comparacao: ComparacaoSetorial): string {
  if (score === null) return "Confluence indisponível para esta empresa.";
  switch (comparacao) {
    case "acima":
      return `Confluence ${score}, acima da média do setor hoje.`;
    case "abaixo":
      return `Confluence ${score}, abaixo da média do setor hoje.`;
    case "na_media":
      return `Confluence ${score}, na média do setor hoje.`;
    case "indisponivel":
      return `Confluence ${score} — sem média setorial calculável para comparar hoje.`;
  }
}
