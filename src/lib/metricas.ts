/**
 * Dicionário das métricas vigiadas pelos gatilhos — em português de gente.
 * Fonte única usada pelas telas para explicar o que cada coisa significa.
 */
export type InfoMetrica = {
  nome: string;
  explicacao: string;
  formato: "percentual" | "reais";
};

export const METRICAS: Record<string, InfoMetrica> = {
  roic: {
    nome: "Retorno sobre o capital (ROIC)",
    explicacao:
      "De cada R$ 100 que a empresa emprega no próprio negócio, quanto ela gera de resultado por ano. É a régua de qualidade: acima de ~12% costuma indicar um negócio que cria valor.",
    formato: "percentual",
  },
  margem_liquida: {
    nome: "Margem líquida",
    explicacao:
      "De cada R$ 100 que a empresa vende, quantos sobram como lucro depois de pagar tudo — custos, despesas, juros e impostos.",
    formato: "percentual",
  },
  divida_liquida: {
    nome: "Dívida líquida",
    explicacao:
      "Total de dívidas menos o dinheiro em caixa. Número NEGATIVO é bom: significa que a empresa tem mais caixa do que dívida (caixa líquido).",
    formato: "reais",
  },
  queda_preco_30d: {
    nome: "Queda do preço em 30 dias",
    explicacao:
      "Quanto a ação caiu em relação ao ponto mais alto dos últimos 30 dias. Queda forte com fundamentos intactos pode ser oportunidade de compra — por isso este gatilho é verde.",
    formato: "percentual",
  },
};

export function fmtValor(metrica: string, v: number): string {
  const info = METRICAS[metrica];
  if (info?.formato === "reais") {
    const bi = v / 1_000_000_000;
    return `R$ ${bi.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  }
  return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function regraEmPortugues(
  metrica: string,
  operador: string,
  valor: number
): string {
  const nome = METRICAS[metrica]?.nome ?? metrica;
  const limite = fmtValor(metrica, valor);
  const verbo =
    operador === "<" || operador === "<=" ? "ficar abaixo de" : "passar de";
  return `Dispara se ${nome.toLowerCase()} ${verbo} ${limite}`;
}

export function condicaoAtendida(
  operador: string,
  atual: number,
  limite: number
): boolean {
  if (operador === "<") return atual < limite;
  if (operador === ">") return atual > limite;
  if (operador === "<=") return atual <= limite;
  return atual >= limite;
}
