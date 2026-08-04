import type { Decision } from "./decision-object";

/**
 * OPPORTUNITY COST ENGINE (Foundation v4 — Módulo 7).
 *
 * Registra o custo de oportunidade de uma escolha: dado um `Decision`
 * escolhido e os `Decision` das alternativas que foram consideradas junto
 * (candidatas que também passaram pelo Master Engine), este motor apenas
 * REGISTRA a diferença de Confluence e Carry entre o escolhido e cada
 * alternativa — nunca diz que a alternativa "deveria" ter sido escolhida,
 * nunca sugere desfazer nada. É um registro histórico para o Decision
 * Journal / futura auditoria, não uma segunda opinião no momento da decisão.
 *
 * Não recalcula nada: todo valor vem pronto de dentro de cada `Decision`
 * (Confluence, Carry) — mesma disciplina de "regras decidem" do resto do
 * domínio. Corte honesto: quando Confluence ou Carry está null em qualquer
 * lado da comparação, o gap correspondente também fica null, com aviso —
 * nunca um número inventado tratando null como zero.
 */

export type GapAlternativa = {
  ticker: string;
  /** escolhida.confluence - alternativa.confluence; null se qualquer lado for null */
  gapConfluence: number | null;
  /** escolhida.carry - alternativa.carry; null se qualquer lado for null */
  gapCarry: number | null;
  /** true = a alternativa tinha Confluence maior que a escolhida no momento da decisão */
  confluenceAlternativaMaior: boolean | null;
  /** true = a alternativa tinha Carry maior que a escolhida no momento da decisão */
  carryAlternativaMaior: boolean | null;
};

export type MelhorAlternativa = { ticker: string; valor: number };

export type ResultadoCustoOportunidade = {
  tickerEscolhido: string;
  alternativas: GapAlternativa[];
  /** alternativa com maior Confluence entre as consideradas, só como registro factual — não é sugestão */
  melhorAlternativaConfluence: MelhorAlternativa | null;
  /** alternativa com maior Carry entre as consideradas, só como registro factual — não é sugestão */
  melhorAlternativaCarry: MelhorAlternativa | null;
  metodo: string;
  avisos: string[];
};

function gapNumerico(escolhida: number | null, alternativa: number | null): number | null {
  return escolhida === null || alternativa === null ? null : escolhida - alternativa;
}

function maiorQue(alternativa: number | null, escolhida: number | null): boolean | null {
  return alternativa === null || escolhida === null ? null : alternativa > escolhida;
}

/**
 * Compara a `Decision` escolhida contra as `Decision` de alternativas que
 * foram consideradas no mesmo momento. Função pura — nenhuma chamada ao
 * Master Engine acontece aqui, os `Decision` já vêm prontos.
 */
export function calcularCustoOportunidade(escolhida: Decision, alternativas: Decision[]): ResultadoCustoOportunidade {
  const avisos: string[] = [];
  const consideradas = alternativas.filter((a) => a.ticker !== escolhida.ticker);

  if (alternativas.length !== consideradas.length) {
    avisos.push(`${escolhida.ticker}: removido da lista de alternativas — é o próprio escolhido, não faz sentido comparar contra si mesmo.`);
  }

  const gaps: GapAlternativa[] = consideradas.map((alt) => {
    if (escolhida.confluence === null || alt.confluence === null) {
      avisos.push(`${alt.ticker}: gap de Confluence indisponível — Confluence null em pelo menos um dos dois lados.`);
    }
    if (escolhida.carry === null || alt.carry === null) {
      avisos.push(`${alt.ticker}: gap de Carry indisponível — Carry null em pelo menos um dos dois lados.`);
    }
    return {
      ticker: alt.ticker,
      gapConfluence: gapNumerico(escolhida.confluence, alt.confluence),
      gapCarry: gapNumerico(escolhida.carry, alt.carry),
      confluenceAlternativaMaior: maiorQue(alt.confluence, escolhida.confluence),
      carryAlternativaMaior: maiorQue(alt.carry, escolhida.carry),
    };
  });

  const comConfluence = consideradas.filter((a): a is Decision & { confluence: number } => a.confluence !== null);
  const melhorAlternativaConfluence =
    comConfluence.length === 0 ? null : comConfluence.reduce((m, a) => (a.confluence > m.confluence ? a : m));

  const comCarry = consideradas.filter((a): a is Decision & { carry: number } => a.carry !== null);
  const melhorAlternativaCarry = comCarry.length === 0 ? null : comCarry.reduce((m, a) => (a.carry > m.carry ? a : m));

  if (consideradas.length === 0) {
    avisos.push("Nenhuma alternativa considerada junto com este ticker — custo de oportunidade não registrado.");
  }

  return {
    tickerEscolhido: escolhida.ticker,
    alternativas: gaps,
    melhorAlternativaConfluence: melhorAlternativaConfluence
      ? { ticker: melhorAlternativaConfluence.ticker, valor: melhorAlternativaConfluence.confluence }
      : null,
    melhorAlternativaCarry: melhorAlternativaCarry ? { ticker: melhorAlternativaCarry.ticker, valor: melhorAlternativaCarry.carry } : null,
    metodo:
      "Opportunity Cost v1 (Foundation v4) — registra a diferença de Confluence e Carry entre o ticker escolhido e cada alternativa considerada no mesmo momento. Registro histórico, não uma segunda opinião nem uma sugestão de troca; a decisão já tomada não é questionada por este motor.",
    avisos,
  };
}
