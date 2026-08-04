import { LIMIAR_CONCENTRACAO_ATIVO } from "./portfolio-fit";

/**
 * CAPITAL ALLOCATION ENGINE (Foundation v4 — Módulo 6).
 *
 * RISCO REGISTRADO ANTES DE CONSTRUIR (ver mensagem ao Carlos no início
 * deste sprint): a especificação pediu literalmente "35% Empresa A, 25%
 * Empresa B..." — uma distribuição percentual específica de capital. Isso
 * esbarra direto na regra 7 do CLAUDE.md deste projeto ("proibido compre/
 * venda/recomendamos") se apresentado como conselho. Mitigação aplicada:
 * este motor é uma CALCULADORA MECÂNICA, determinística e versionada — a
 * mesma disciplina de "regras decidem" que já rege Score/Carry/Confluence
 * neste sistema. Ele nunca decide o que Carlos deve fazer; ele responde
 * "dado ESTE piso de convicção e ESTE teto de concentração, qual a
 * distribuição proporcional ao Confluence Score entre os candidatos
 * elegíveis" — um cálculo, não uma recomendação. `premissas` no resultado
 * lista TODOS os parâmetros usados, sempre, pra nunca esconder a régua por
 * trás do número.
 *
 * Reaproveita `LIMIAR_CONCENTRACAO_ATIVO` (portfolio-fit.ts) como teto
 * padrão — mesma régua de concentração em vez de inventar uma segunda.
 */

export type CandidatoAlocacao = {
  ticker: string;
  confluenceScore: number | null;
};

export type ItemAlocacao = {
  ticker: string;
  percentual: number; // 0-1
};

export type ResultadoAlocacao = {
  itens: ItemAlocacao[];
  percentualCaixa: number;
  metodo: string;
  premissas: string[];
  avisos: string[];
};

/** Confluence mínima para entrar na distribuição — abaixo disso, "sem convicção suficiente para alocar capital" (não é zero disfarçado: fica de fora e diz por quê). */
export const PISO_CONFLUENCE_ALOCACAO = 50;

export type OpcoesAlocacao = {
  limiarConcentracaoMax?: number;
  pisoConfluence?: number;
};

function arredondar(v: number): number {
  return Math.round(v * 10_000) / 10_000;
}

/**
 * Distribui capital proporcionalmente ao Confluence Score entre candidatos
 * elegíveis, respeitando um teto de concentração por ativo — nunca decide
 * QUAL empresa comprar, só COMO DIVIDIR entre as que já foram escolhidas
 * como candidatas por quem chama. Função pura e determinística.
 */
export function calcularAlocacaoCapital(candidatos: CandidatoAlocacao[], opcoes: OpcoesAlocacao = {}): ResultadoAlocacao {
  const limiarConcentracaoMax = opcoes.limiarConcentracaoMax ?? LIMIAR_CONCENTRACAO_ATIVO;
  const pisoConfluence = opcoes.pisoConfluence ?? PISO_CONFLUENCE_ALOCACAO;
  const avisos: string[] = [];

  const premissas = [
    `Piso de Confluence para entrar na distribuição: ${pisoConfluence} pontos.`,
    `Teto de concentração por ativo: ${(limiarConcentracaoMax * 100).toFixed(0)}% da alocação total.`,
    "Distribuição proporcional ao Confluence Score entre os candidatos elegíveis — cálculo mecânico, não uma recomendação de compra ou venda.",
  ];

  const elegiveis = candidatos.filter((c) => {
    if (c.confluenceScore === null) {
      avisos.push(`${c.ticker}: fora da distribuição — Confluence Score indisponível.`);
      return false;
    }
    if (c.confluenceScore < pisoConfluence) {
      avisos.push(`${c.ticker}: fora da distribuição — Confluence ${c.confluenceScore} abaixo do piso de ${pisoConfluence}.`);
      return false;
    }
    return true;
  });

  if (elegiveis.length === 0) {
    return {
      itens: [],
      percentualCaixa: 1,
      metodo: "Capital Allocation v1 (Foundation v4) — nenhum candidato elegível, 100% em caixa por definição do cálculo, nunca uma recomendação.",
      premissas,
      avisos: [...avisos, "Nenhum candidato elegível — 100% em caixa."],
    };
  }

  const pesos = new Map(elegiveis.map((c) => [c.ticker, c.confluenceScore!]));
  const fixados = new Map<string, number>();
  const livres = new Set(elegiveis.map((c) => c.ticker));

  let mudou = true;
  while (mudou) {
    mudou = false;
    const espacoRestante = 1 - [...fixados.values()].reduce((a, b) => a + b, 0);
    const somaPesosLivres = [...livres].reduce((a, t) => a + pesos.get(t)!, 0);
    if (somaPesosLivres === 0 || espacoRestante <= 0) break;
    for (const t of [...livres]) {
      const proposto = espacoRestante * (pesos.get(t)! / somaPesosLivres);
      if (proposto > limiarConcentracaoMax + 1e-9) {
        fixados.set(t, limiarConcentracaoMax);
        livres.delete(t);
        mudou = true;
        avisos.push(`${t}: limitado ao teto de concentração (${(limiarConcentracaoMax * 100).toFixed(0)}%), excedente redistribuído entre os demais.`);
      }
    }
  }

  const espacoFinal = Math.max(0, 1 - [...fixados.values()].reduce((a, b) => a + b, 0));
  const somaPesosLivresFinal = [...livres].reduce((a, t) => a + pesos.get(t)!, 0);

  const itens: ItemAlocacao[] = elegiveis.map((c) => {
    if (fixados.has(c.ticker)) return { ticker: c.ticker, percentual: arredondar(fixados.get(c.ticker)!) };
    const percentual = somaPesosLivresFinal > 0 ? espacoFinal * (pesos.get(c.ticker)! / somaPesosLivresFinal) : 0;
    return { ticker: c.ticker, percentual: arredondar(percentual) };
  });

  const somaItens = itens.reduce((a, i) => a + i.percentual, 0);
  const percentualCaixa = arredondar(Math.max(0, 1 - somaItens));

  return {
    itens,
    percentualCaixa,
    metodo:
      "Capital Allocation v1 (Foundation v4) — distribuição proporcional ao Confluence Score entre candidatos com convicção mínima, com teto de concentração por ativo. Cálculo mecânico e versionado sob os parâmetros listados em `premissas` — nunca uma recomendação de compra ou venda; a decisão de quais empresas considerar continua inteiramente de quem chama.",
    premissas,
    avisos,
  };
}
