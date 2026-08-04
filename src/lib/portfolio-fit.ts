import { mapaFaixas, mediaPonderadaRenormalizada, type ComponentePonderado } from "./faixas";
import { CARRY_FAIXAS } from "./confluencia";
import { indiceAcumulado, type ObservacaoBenchmark } from "./patrimonio";
import { sensibilidadeJuros } from "./compounder/sensibilidade-juros";
import type { ModeloAnalise } from "./setores";

/**
 * PORTFOLIO FIT ENGINE (Foundation v4 — Módulo 5).
 *
 * "Uma empresa excelente pode ser ruim para determinada carteira" — este
 * motor não pergunta se a empresa é boa (isso é o Confluence/Decision
 * Object), pergunta o quanto ela ENCAIXA na carteira atual.
 *
 * A especificação pediu 8 fatores: Diversificação, Concentração,
 * Correlação, Setor, Macro, Carry, Growth, Liquidez. "Diversificação" e
 * "Setor" viraram UM componente aqui (`setor`) — são a mesma pergunta
 * numericamente (o quanto a nova posição concentra a carteira num setor),
 * fundir evitou o mesmo tipo de duplicação que o Módulo 8 já sinalizou em
 * outros lugares.
 *
 * Reaproveita, sem duplicar: `mediaPonderadaRenormalizada`/`mapaFaixas`
 * (faixas.ts), `CARRY_FAIXAS` (confluencia.ts), `indiceAcumulado`
 * (patrimonio.ts), `sensibilidadeJuros` (compounder/sensibilidade-juros.ts).
 *
 * Corte honesto sobre Correlação: com poucos meses de preço coletado, uma
 * correlação calculada é estatisticamente frágil — por isso o gate de
 * `MIN_PREGOES_CORRELACAO` abaixo, no mesmo espírito do gate de janelas do
 * Probability Engine V2. Abaixo do mínimo, o componente fica null com
 * motivo, nunca um número.
 */

export type ComponentePortfolioFitId = "concentracao" | "setor" | "correlacao" | "macro" | "carry" | "growth" | "liquidez";

export type ComponentePortfolioFit = {
  id: ComponentePortfolioFitId;
  nome: string;
  peso: number;
  valor: number | null;
  explicacao: string;
};

export type ResultadoPortfolioFit = {
  ticker: string;
  scoreEncaixe: number | null;
  componentesDisponiveis: number;
  componentesTotal: number;
  componentes: ComponentePortfolioFit[];
  metodo: string;
};

export const PESOS_PORTFOLIO_FIT: Record<ComponentePortfolioFitId, number> = {
  concentracao: 0.15,
  setor: 0.15,
  correlacao: 0.2,
  macro: 0.1,
  carry: 0.2,
  growth: 0.1,
  liquidez: 0.1,
};

/** Acima deste peso individual na carteira (incluindo a posição proposta), a concentração começa a penalizar. */
export const LIMIAR_CONCENTRACAO_ATIVO = 0.15;
/** Mesma régua, agregada por setor. */
export const LIMIAR_CONCENTRACAO_SETOR = 0.3;
/** Mínimo de pregões em comum para calcular correlação — abaixo disso, a amostra é frágil demais pra reportar. */
export const MIN_PREGOES_CORRELACAO = 60;

/** Penalidade linear: 100 até o limiar, cai linearmente até 0 no dobro do limiar. */
function pontuarConcentracao(pesoTotal: number, limiar: number): number {
  if (pesoTotal <= limiar) return 100;
  const excesso = pesoTotal - limiar;
  return Math.max(0, Math.round(100 * (1 - excesso / limiar)));
}

/** Correlação de Pearson entre duas séries de mesmo tamanho. Retorna null se variância zero ou tamanhos diferentes. */
export function correlacaoPearson(a: number[], b: number[]): number | null {
  if (a.length !== b.length || a.length === 0) return null;
  const mediaA = a.reduce((x, y) => x + y, 0) / a.length;
  const mediaB = b.reduce((x, y) => x + y, 0) / b.length;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < a.length; i++) {
    const da = a[i] - mediaA;
    const db = b[i] - mediaB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return null;
  return cov / Math.sqrt(varA * varB);
}

export type PosicaoExistente = {
  ticker: string;
  setor: string | null;
  pesoNaCarteira: number; // 0-1
  precos?: ObservacaoBenchmark[]; // opcional — só entra na correlação se presente
};

export type CandidataPortfolioFit = {
  ticker: string;
  setor: string | null;
  modelo: ModeloAnalise | null;
  pesoProposto: number; // 0-1, fração que a posição teria após a compra
  carryReal: number | null;
  growthScore: number | null; // reaproveita Decision.growth — hoje quase sempre null (Confluence v2)
  alavancagem: number | null;
  retencao: number | null; // 1 - payout, usado pela sensibilidadeJuros
  precos?: ObservacaoBenchmark[];
  /** volume financeiro médio diário (R$) já calculado pelo chamador — precos_diarios.volume × fechamento */
  volumeMedioReais: number | null;
};

/** Faixas provisórias de liquidez (R$/dia) → 0-100. Documentado como heurística inicial, não calibrada. */
const LIQUIDEZ_FAIXAS: [number, number][] = [
  [0, 0],
  [100_000, 20],
  [1_000_000, 50],
  [10_000_000, 80],
  [50_000_000, 100],
];

function calcularConcentracaoESetor(
  candidata: CandidataPortfolioFit,
  posicoes: PosicaoExistente[]
): { concentracao: number; setor: number; pesoSetorAtual: number } {
  const concentracao = pontuarConcentracao(candidata.pesoProposto, LIMIAR_CONCENTRACAO_ATIVO);

  const pesoSetorAtual = candidata.setor === null ? 0 : posicoes.filter((p) => p.setor === candidata.setor).reduce((a, p) => a + p.pesoNaCarteira, 0);
  const pesoSetorComNova = pesoSetorAtual + candidata.pesoProposto;
  const setor = candidata.setor === null ? 50 : pontuarConcentracao(pesoSetorComNova, LIMIAR_CONCENTRACAO_SETOR);

  return { concentracao, setor, pesoSetorAtual };
}

function calcularCorrelacao(candidata: CandidataPortfolioFit, posicoes: PosicaoExistente[]): { valor: number | null; explicacao: string } {
  const comPreco = posicoes.filter((p) => p.precos && p.precos.length > 0 && p.pesoNaCarteira > 0);
  if (!candidata.precos || candidata.precos.length === 0 || comPreco.length === 0) {
    return { valor: null, explicacao: "Sem histórico de preço suficiente (do candidato ou das posições atuais) para calcular correlação." };
  }

  const datasCandidato = new Set(candidata.precos.map((p) => p.data));
  const correlacoes: { corr: number; peso: number }[] = [];

  for (const posicao of comPreco) {
    const datasComuns = posicao.precos!.map((p) => p.data).filter((d) => datasCandidato.has(d));
    if (datasComuns.length < MIN_PREGOES_CORRELACAO) continue;

    const idxCandidato = indiceAcumulado(candidata.precos, "nivel", datasComuns);
    const idxPosicao = indiceAcumulado(posicao.precos!, "nivel", datasComuns);

    const retCandidato: number[] = [];
    const retPosicao: number[] = [];
    for (let i = 1; i < datasComuns.length; i++) {
      const a0 = idxCandidato.get(datasComuns[i - 1]);
      const a1 = idxCandidato.get(datasComuns[i]);
      const b0 = idxPosicao.get(datasComuns[i - 1]);
      const b1 = idxPosicao.get(datasComuns[i]);
      if (a0 !== null && a0 !== undefined && a1 !== null && a1 !== undefined && b0 !== null && b0 !== undefined && b1 !== null && b1 !== undefined) {
        retCandidato.push(a1 / a0 - 1);
        retPosicao.push(b1 / b0 - 1);
      }
    }
    const corr = correlacaoPearson(retCandidato, retPosicao);
    if (corr !== null) correlacoes.push({ corr, peso: posicao.pesoNaCarteira });
  }

  if (correlacoes.length === 0) {
    return {
      valor: null,
      explicacao: `Nenhuma posição da carteira tem pelo menos ${MIN_PREGOES_CORRELACAO} pregões em comum com o candidato — amostra frágil demais para reportar.`,
    };
  }

  const pesoTotal = correlacoes.reduce((a, c) => a + c.peso, 0);
  const mediaCorrelacao = pesoTotal > 0 ? correlacoes.reduce((a, c) => a + c.corr * c.peso, 0) / pesoTotal : correlacoes.reduce((a, c) => a + c.corr, 0) / correlacoes.length;
  const score = Math.round(((1 - mediaCorrelacao) / 2) * 100);

  return {
    valor: score,
    explicacao: `Correlação média ponderada de ${mediaCorrelacao.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} com ${correlacoes.length} posição(ões) da carteira (mínimo de ${MIN_PREGOES_CORRELACAO} pregões em comum por par) — correlação negativa aumenta o score (diversifica), positiva reduz.`,
  };
}

/** Calcula o quanto uma empresa candidata encaixa na carteira atual — nunca decide se ela é boa (isso é o Confluence). */
export function calcularPortfolioFit(candidata: CandidataPortfolioFit, posicoes: PosicaoExistente[]): ResultadoPortfolioFit {
  const { concentracao, setor, pesoSetorAtual } = calcularConcentracaoESetor(candidata, posicoes);
  const correlacao = calcularCorrelacao(candidata, posicoes);

  const sensibilidade = sensibilidadeJuros({ alavancagem: candidata.alavancagem, retencao: candidata.retencao, modelo: candidata.modelo });
  const macro = sensibilidade.categoria === null ? null : Math.max(0, Math.min(100, 60 - sensibilidade.pontos * 12));

  const carry = candidata.carryReal !== null ? mapaFaixas(candidata.carryReal, CARRY_FAIXAS) : null;
  const liquidez = candidata.volumeMedioReais !== null ? mapaFaixas(candidata.volumeMedioReais, LIQUIDEZ_FAIXAS) : null;

  const componentes: ComponentePortfolioFit[] = [
    {
      id: "concentracao",
      nome: "Concentração (peso individual na carteira)",
      peso: PESOS_PORTFOLIO_FIT.concentracao,
      valor: concentracao,
      explicacao: `Com esta posição, o ativo passaria a pesar ${(candidata.pesoProposto * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da carteira (limiar de referência: ${(LIMIAR_CONCENTRACAO_ATIVO * 100).toFixed(0)}%).`,
    },
    {
      id: "setor",
      nome: "Setor (diversificação setorial)",
      peso: PESOS_PORTFOLIO_FIT.setor,
      valor: setor,
      explicacao:
        candidata.setor === null
          ? "Setor da empresa não informado — sem como medir concentração setorial."
          : `Setor '${candidata.setor}' já representa ${(pesoSetorAtual * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% da carteira antes desta posição (limiar de referência: ${(LIMIAR_CONCENTRACAO_SETOR * 100).toFixed(0)}%).`,
    },
    { id: "correlacao", nome: "Correlação histórica com a carteira", peso: PESOS_PORTFOLIO_FIT.correlacao, valor: correlacao.valor, explicacao: correlacao.explicacao },
    {
      id: "macro",
      nome: "Sensibilidade macro (Selic)",
      peso: PESOS_PORTFOLIO_FIT.macro,
      valor: macro,
      explicacao:
        sensibilidade.categoria === null
          ? "Sem alavancagem nem retenção calculáveis para estimar sensibilidade à Selic."
          : `Sensibilidade à Selic: ${sensibilidade.categoria} (heurística declarada, não calibrada — ver compounder/sensibilidade-juros.ts). Só cobre Selic; IPCA/PIB/Dólar/Commodities não têm modelo de sensibilidade hoje.`,
    },
    {
      id: "carry",
      nome: "Carry",
      peso: PESOS_PORTFOLIO_FIT.carry,
      valor: carry,
      explicacao: candidata.carryReal !== null ? `Carry real IPCA + ${(candidata.carryReal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% a.a.` : "Carry incalculável para esta empresa.",
    },
    {
      id: "growth",
      nome: "Growth",
      peso: PESOS_PORTFOLIO_FIT.growth,
      valor: candidata.growthScore,
      explicacao: candidata.growthScore !== null ? `Growth Score ${candidata.growthScore}.` : "Sem motor de Growth isolado hoje (mesma pendência do Confluence v2 — ver confluencia.ts).",
    },
    {
      id: "liquidez",
      nome: "Liquidez (volume financeiro médio diário)",
      peso: PESOS_PORTFOLIO_FIT.liquidez,
      valor: liquidez,
      explicacao:
        candidata.volumeMedioReais !== null
          ? `Volume médio diário de ${candidata.volumeMedioReais.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} (faixas provisórias, não calibradas).`
          : "Sem volume médio calculado para esta empresa.",
    },
  ];

  const { valor, pesoDisponivel } = mediaPonderadaRenormalizada(componentes.map((c): ComponentePonderado => ({ peso: c.peso, valor: c.valor })));
  const disponiveis = componentes.filter((c) => c.valor !== null);

  return {
    ticker: candidata.ticker,
    scoreEncaixe: valor === null ? null : Math.round(valor),
    componentesDisponiveis: disponiveis.length,
    componentesTotal: componentes.length,
    componentes,
    metodo: `Portfolio Fit v1 (Foundation v4) — 7 componentes (Concentração/Setor/Correlação/Macro/Carry/Growth/Liquidez), peso renormalizado entre os ${disponiveis.length}/${componentes.length} disponíveis (${(pesoDisponivel * 100).toFixed(0)}% do peso total coberto). Responde o quanto a empresa ENCAIXA na carteira — não se ela é boa (isso é o Confluence Score). Nunca é recomendação de compra ou venda.`,
  };
}
