import { sensibilidadeJuros, type CategoriaSensibilidade } from "./compounder/sensibilidade-juros";
import type { ModeloAnalise } from "./setores";

/**
 * SCENARIO ENGINE (Foundation v4 — Módulo 10).
 *
 * A especificação pede cenários Base/Otimista/Pessimista/Estressado para
 * Selic/IPCA/PIB/Dólar/Commodities, com impacto em setores/empresas/
 * carteira. "Não criar dois motores resolvendo o mesmo problema": este
 * motor reaproveita `sensibilidadeJuros` (compounder/sensibilidade-juros.ts,
 * já uma "heurística declarada", nunca calibrada contra preço real) para o
 * ÚNICO canal de impacto quantificável hoje — a direção da Selic em cada
 * cenário. IPCA, PIB, Dólar e Commodities aparecem nas premissas de cada
 * cenário (só como descrição qualitativa da narrativa, nunca um número
 * inventado) mas o `impacto` desses quatro fatores fica sempre `null` com
 * motivo — não existe motor de sensibilidade calibrado para eles ainda.
 *
 * Corte honesto explícito no mapeamento Selic→impacto: só as duas
 * categorias mais fortes de sensibilidade (`muito_alta`/`alta`) geram uma
 * chamada direcional (positivo quando a Selic cai, negativo quando sobe).
 * `media`/`baixa`/`muito_baixa` sempre viram "neutro" — o motor de
 * sensibilidade mede exposição À QUEDA da Selic, não o efeito espelhado de
 * uma alta, e inventar uma magnitude pra essas categorias seria o tipo de
 * número fabricado que este sistema nunca produz.
 */

export type CenarioMacro = "base" | "otimista" | "pessimista" | "estressado";
export type FatorMacro = "selic" | "ipca" | "pib" | "dolar" | "commodities";
export type DirecaoSelic = "queda" | "alta" | "estavel";
export type ImpactoQualitativo = "positivo" | "neutro" | "negativo";

export const ROTULO_CENARIO: Record<CenarioMacro, string> = {
  base: "Base",
  otimista: "Otimista",
  pessimista: "Pessimista",
  estressado: "Estressado",
};

/** Narrativa qualitativa de cada cenário por fator — descrição, nunca um número; premissa registrada, não previsão. */
export const PREMISSA_CENARIO: Record<CenarioMacro, Record<FatorMacro, string>> = {
  base: {
    selic: "Selic mantém o patamar atual.",
    ipca: "Inflação dentro da meta do BCB.",
    pib: "Crescimento moderado, em linha com o potencial.",
    dolar: "Câmbio estável.",
    commodities: "Preços de commodities estáveis.",
  },
  otimista: {
    selic: "Ciclo de queda da Selic.",
    ipca: "Inflação abaixo da meta.",
    pib: "Crescimento acelera.",
    dolar: "Real se valoriza.",
    commodities: "Preços de commodities em alta.",
  },
  pessimista: {
    selic: "Ciclo de alta da Selic.",
    ipca: "Inflação acima da meta.",
    pib: "Crescimento desacelera.",
    dolar: "Real se desvaloriza.",
    commodities: "Preços de commodities em queda.",
  },
  estressado: {
    selic: "Alta forte e rápida da Selic.",
    ipca: "Inflação muito acima da meta, risco de desancoragem.",
    pib: "Recessão.",
    dolar: "Forte desvalorização do real.",
    commodities: "Queda forte e generalizada de preços de commodities.",
  },
};

export const DIRECAO_SELIC_POR_CENARIO: Record<CenarioMacro, DirecaoSelic> = {
  base: "estavel",
  otimista: "queda",
  pessimista: "alta",
  estressado: "alta",
};

const CATEGORIAS_COM_CHAMADA_DIRECIONAL: CategoriaSensibilidade[] = ["muito_alta", "alta"];

export type ImpactoFatorNaoCalibrado = { impacto: null; motivo: string };

export type ImpactoSelic = {
  direcao: DirecaoSelic;
  sensibilidade: CategoriaSensibilidade | null;
  impacto: ImpactoQualitativo | null;
  explicacao: string;
};

export type ResultadoImpactoCenario = {
  ticker: string;
  cenario: CenarioMacro;
  selic: ImpactoSelic;
  ipca: ImpactoFatorNaoCalibrado;
  pib: ImpactoFatorNaoCalibrado;
  dolar: ImpactoFatorNaoCalibrado;
  commodities: ImpactoFatorNaoCalibrado;
  premissas: Record<FatorMacro, string>;
  avisos: string[];
};

const MOTIVO_FATOR_NAO_CALIBRADO = (fator: string): string =>
  `Sem motor de sensibilidade calibrado para ${fator} ainda — só Selic tem canal de impacto quantificado hoje (via sensibilidadeJuros).`;

function impactoPorDirecao(sensibilidade: CategoriaSensibilidade | null, direcao: DirecaoSelic): { impacto: ImpactoQualitativo | null; explicacao: string } {
  if (sensibilidade === null) {
    return { impacto: null, explicacao: "Sensibilidade à Selic indisponível (falta alavancagem e retenção de lucro) — impacto não avaliado." };
  }
  if (direcao === "estavel") {
    return { impacto: "neutro", explicacao: "Cenário assume Selic estável — sem direção de movimento pra aplicar a sensibilidade." };
  }
  const chamadaDirecional = CATEGORIAS_COM_CHAMADA_DIRECIONAL.includes(sensibilidade);
  if (!chamadaDirecional) {
    return {
      impacto: "neutro",
      explicacao: `Sensibilidade "${sensibilidade}" não é forte o suficiente para uma chamada direcional — motor só assume positivo/negativo para muito_alta/alta.`,
    };
  }
  const impacto: ImpactoQualitativo = direcao === "queda" ? "positivo" : "negativo";
  return {
    impacto,
    explicacao: `Sensibilidade "${sensibilidade}" à Selic + cenário de ${direcao === "queda" ? "queda" : "alta"} de juros → impacto ${impacto}.`,
  };
}

/**
 * Avalia o impacto de um cenário macro sobre uma empresa. Função pura —
 * reaproveita `sensibilidadeJuros` para o canal de Selic; os demais fatores
 * (IPCA/PIB/Dólar/Commodities) ficam null+motivo por falta de motor.
 */
export function avaliarImpactoCenario(
  ticker: string,
  cenario: CenarioMacro,
  empresa: { alavancagem: number | null; retencao: number | null; modelo: ModeloAnalise | null }
): ResultadoImpactoCenario {
  const avisos: string[] = [];
  const { categoria } = sensibilidadeJuros(empresa);
  const direcao = DIRECAO_SELIC_POR_CENARIO[cenario];
  const { impacto, explicacao } = impactoPorDirecao(categoria, direcao);

  if (categoria === null) {
    avisos.push(`${ticker}: sensibilidade à Selic indisponível — canal de Selic também fica sem chamada direcional para este cenário.`);
  }

  return {
    ticker,
    cenario,
    selic: { direcao, sensibilidade: categoria, impacto, explicacao },
    ipca: { impacto: null, motivo: MOTIVO_FATOR_NAO_CALIBRADO("IPCA") },
    pib: { impacto: null, motivo: MOTIVO_FATOR_NAO_CALIBRADO("PIB") },
    dolar: { impacto: null, motivo: MOTIVO_FATOR_NAO_CALIBRADO("Dólar") },
    commodities: { impacto: null, motivo: MOTIVO_FATOR_NAO_CALIBRADO("Commodities") },
    premissas: PREMISSA_CENARIO[cenario],
    avisos,
  };
}

export type ResultadoImpactoCarteira = {
  cenario: CenarioMacro;
  porEmpresa: ResultadoImpactoCenario[];
  contagem: { positivo: number; neutro: number; negativo: number; naoAvaliado: number };
};

/** Aplica `avaliarImpactoCenario` a cada posição da carteira e agrega a contagem de impacto pelo canal de Selic — nenhum novo cálculo por trás. */
export function avaliarImpactoCarteira(
  cenario: CenarioMacro,
  empresas: { ticker: string; alavancagem: number | null; retencao: number | null; modelo: ModeloAnalise | null }[]
): ResultadoImpactoCarteira {
  const porEmpresa = empresas.map((e) => avaliarImpactoCenario(e.ticker, cenario, e));
  const contagem = { positivo: 0, neutro: 0, negativo: 0, naoAvaliado: 0 };
  for (const r of porEmpresa) {
    if (r.selic.impacto === "positivo") contagem.positivo++;
    else if (r.selic.impacto === "negativo") contagem.negativo++;
    else if (r.selic.impacto === "neutro") contagem.neutro++;
    else contagem.naoAvaliado++;
  }
  return { cenario, porEmpresa, contagem };
}
