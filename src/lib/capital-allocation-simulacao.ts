import { calcularAlocacaoCapital, PISO_CONFLUENCE_ALOCACAO, type CandidatoAlocacao } from "./capital-allocation";
import { LIMIAR_CONCENTRACAO_ATIVO } from "./portfolio-fit";
import { hhi } from "./portfolio-attribution";
import { rotularConcentracao, type ConcentracaoRotulo } from "./portfolio-health";

/**
 * CAPITAL ALLOCATION — SIMULAÇÃO SOBRE A CARTEIRA (Bloco 2, Sprint 2.9,
 * Wealth Intelligence Layer — Módulo 3).
 *
 * ACHADO IMPORTANTE (registrado, não escondido): `capital-allocation.ts`
 * JÁ EXISTE como motor congelado (Foundation v4, Módulo 6,
 * `calcularAlocacaoCapital`) — distribui capital proporcionalmente ao
 * Confluence Score entre candidatos elegíveis, respeitando piso de
 * convicção e teto de concentração. Nunca foi conectado a nenhuma tela
 * (confirmado por busca no código: zero usos fora do próprio arquivo e
 * seus testes). Cheguei a escrever, por engano, uma segunda fórmula de
 * "score de alocação" do zero antes de descobrir isso — o Write foi
 * bloqueado pelo próprio editor (arquivo já existia) antes de sobrescrever
 * o motor congelado. Este arquivo existe pra NÃO repetir esse erro: é só
 * uma camada de composição que alimenta `calcularAlocacaoCapital` com a
 * carteira atual (cada posição vira um "candidato") e traduz a saída pro
 * vocabulário que a spec pediu (peso atual/sugerido/faixa saudável/impacto
 * esperado) — nenhum cálculo novo de alocação.
 *
 * "Peso sugerido" aqui responde: "se eu redistribuísse 100% do valor da
 * carteira hoje seguindo só a regra de Confluence + teto de concentração,
 * como ficaria". SEMPRE simulação (rule 7 do CLAUDE.md) — nunca uma ordem.
 */

export type EntradaPosicaoCapitalAllocation = {
  ticker: string;
  pesoAtual: number; // 0-1
  confluence: number | null;
};

export type PosicaoCapitalAllocation = {
  ticker: string;
  pesoAtual: number;
  pesoSugerido: number | null; // null = fora da distribuição (ver motivoForaDistribuicao)
  motivoForaDistribuicao: string | null;
  faixaSaudavel: { min: number; max: number };
  impactoTexto: string;
};

export type ResultadoCapitalAllocationView = {
  posicoes: PosicaoCapitalAllocation[];
  concentracaoAtual: ConcentracaoRotulo;
  concentracaoSimulada: ConcentracaoRotulo;
  percentualForaDistribuicao: number; // soma do peso atual dos tickers sem convicção suficiente (Confluence abaixo do piso) — "caixa" no vocabulário do motor original, aqui é "sem convicção pra alocar"
  premissas: string[];
  aviso: string;
};

const AVISO =
  "Simulação de rebalanceamento — mostra como a carteira ficaria SE 100% do valor fosse redistribuído hoje seguindo só a regra de Confluence + teto de concentração. Nunca é uma ordem de compra ou venda; a decisão é sempre sua.";

export function montarCapitalAllocationView(
  entradas: EntradaPosicaoCapitalAllocation[]
): ResultadoCapitalAllocationView {
  const n = entradas.length;
  if (n === 0) {
    return {
      posicoes: [],
      concentracaoAtual: "baixa",
      concentracaoSimulada: "baixa",
      percentualForaDistribuicao: 0,
      premissas: [],
      aviso: AVISO,
    };
  }

  const candidatos: CandidatoAlocacao[] = entradas.map((e) => ({ ticker: e.ticker, confluenceScore: e.confluence }));
  const resultado = calcularAlocacaoCapital(candidatos);
  const pesoSugeridoPorTicker = new Map(resultado.itens.map((i) => [i.ticker, i.percentual]));

  const foraDistribuicao = entradas.filter((e) => !pesoSugeridoPorTicker.has(e.ticker));
  const percentualForaDistribuicao = foraDistribuicao.reduce((a, e) => a + e.pesoAtual, 0);

  const faixaSaudavel = { min: 0, max: LIMIAR_CONCENTRACAO_ATIVO };

  const posicoes: PosicaoCapitalAllocation[] = entradas.map((e) => {
    const pesoSugerido = pesoSugeridoPorTicker.get(e.ticker) ?? null;
    let motivoForaDistribuicao: string | null = null;
    let impactoTexto: string;

    if (pesoSugerido === null) {
      motivoForaDistribuicao =
        e.confluence === null
          ? "Confluence Score indisponível — fora da simulação."
          : `Confluence ${e.confluence} abaixo do piso de convicção (${PISO_CONFLUENCE_ALOCACAO}) — fora da simulação.`;
      impactoTexto = "Sem convicção suficiente pra entrar na simulação de alocação.";
    } else {
      const delta = pesoSugerido - e.pesoAtual;
      const deltaPP = Math.abs(delta * 100).toFixed(1);
      impactoTexto =
        Math.abs(delta) < 0.005
          ? "Peso atual já está próximo do sugerido pela simulação."
          : delta > 0
          ? `Simulação sugere aumentar ${deltaPP}pp — Confluence relativamente mais forte.`
          : `Simulação sugere reduzir ${deltaPP}pp — Confluence relativamente mais fraca ou teto de concentração atingido.`;
    }

    return {
      ticker: e.ticker,
      pesoAtual: e.pesoAtual,
      pesoSugerido,
      motivoForaDistribuicao,
      faixaSaudavel,
      impactoTexto,
    };
  });

  const pesosAtuais = entradas.map((e) => e.pesoAtual);
  const pesosSimulados = entradas.map((e) => pesoSugeridoPorTicker.get(e.ticker) ?? 0);

  return {
    posicoes,
    concentracaoAtual: rotularConcentracao(hhi(pesosAtuais)),
    concentracaoSimulada: rotularConcentracao(hhi(pesosSimulados)),
    percentualForaDistribuicao,
    premissas: resultado.premissas,
    aviso: AVISO,
  };
}
