import { mapaFaixas } from "./faixas";

/**
 * CONFLUENCE ENGINE v1.
 *
 * Combina os motores que já existem (Fundamentos + Carry + Compounder +
 * Technical) numa nota única 0-100 + rótulo de "Convicção" — um dos
 * indicadores principais pedidos na especificação do Technical Engine.
 *
 * Corte honesto explícito (documentado, nunca escondido): a especificação
 * original também pedia Macro, Fluxo (fluxo de capital/institucional) e
 * Gestão como entradas da Confluência. Nenhum desses três é modelado como
 * NÚMERO hoje:
 * - Macro: existe como CONTEXTO (Focus/Selic/CDI/IPCA, sensibilidade à
 *   Selic do Compounder) mas não é um score comparável entre empresas.
 * - Fluxo (institucional/estrangeiro): não há fonte de dado coletada.
 * - Gestão: mesmo buraco documentado no Compounder Engine — sem proxy
 *   honesto disponível hoje.
 * Esses três ficam DE FORA da soma (não são "peso zero disfarçado" — são
 * ausência documentada). Os 4 pesos abaixo somam 100% sozinhos.
 */

export type ComponenteConfluenciaId = "fundamentos" | "carry" | "compounder" | "technical";

export type ComponenteConfluencia = {
  id: ComponenteConfluenciaId;
  nome: string;
  peso: number;
  valor: number | null;
  explicacao: string;
};

export type Conviccao = "alta" | "moderada" | "baixa" | "indefinida";

export const ROTULO_CONVICCAO: Record<Conviccao, string> = {
  alta: "Alta convicção",
  moderada: "Convicção moderada",
  baixa: "Baixa convicção",
  indefinida: "Indefinida (dado insuficiente)",
};

/**
 * Régua única de convicção — usada tanto por empresa (calcularConfluencia,
 * onde `coberturaFrac` é o peso disponível entre os 4 componentes) quanto
 * no agregado de carteira (confluenciaMediaPonderada em portfolio-health.ts,
 * onde `coberturaFrac` é a fração de posições com Confluence Score
 * calculável). Extraída em 03/08/2026 para não duplicar a lógica em dois
 * lugares — mesma régua, dois usos.
 */
export function classificarConviccao(score: number | null, coberturaFrac: number): Conviccao {
  if (score === null || coberturaFrac < 0.4) return "indefinida";
  if (score >= 75 && coberturaFrac >= 0.7) return "alta";
  if (score >= 50) return "moderada";
  return "baixa";
}

export type ConfluenciaResultado = {
  score: number | null;
  conviccao: Conviccao;
  componentesDisponiveis: number;
  componentesTotal: number;
  componentes: ComponenteConfluencia[];
  metodo: string;
};

export const CONFLUENCIA_PESOS: Record<ComponenteConfluenciaId, number> = {
  fundamentos: 0.3,
  carry: 0.2,
  compounder: 0.25,
  technical: 0.25,
};

/** Exportado (Foundation v3) para reaproveitar a mesma régua Carry→0-100 no Confluence v2 e no Master Engine. */
export const CARRY_FAIXAS: [number, number][] = [
  [-0.02, 10],
  [0, 30],
  [0.04, 50],
  [0.08, 70],
  [0.15, 90],
  [0.25, 100],
];

export function calcularConfluencia(entrada: {
  fundamentosScore: number | null;
  fundamentosComponentes: number;
  carryReal: number | null;
  compounderScore: number | null;
  technicalScore: number | null;
}): ConfluenciaResultado {
  const componentes: ComponenteConfluencia[] = [
    {
      id: "fundamentos",
      nome: "Fundamentos (Score Final)",
      peso: CONFLUENCIA_PESOS.fundamentos,
      valor: entrada.fundamentosComponentes > 0 ? entrada.fundamentosScore : null,
      explicacao:
        entrada.fundamentosComponentes > 0
          ? `Score Final (réguas versionadas) ${entrada.fundamentosScore}.`
          : "Sem réguas de fundamentos aplicáveis ainda.",
    },
    {
      id: "carry",
      nome: "Carry (piso/growth)",
      peso: CONFLUENCIA_PESOS.carry,
      valor: entrada.carryReal !== null ? mapaFaixas(entrada.carryReal, CARRY_FAIXAS) : null,
      explicacao:
        entrada.carryReal !== null
          ? `Carry real IPCA + ${(entrada.carryReal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% a.a.`
          : "Carry incalculável para esta empresa.",
    },
    {
      id: "compounder",
      nome: "Compounder Score",
      peso: CONFLUENCIA_PESOS.compounder,
      valor: entrada.compounderScore,
      explicacao:
        entrada.compounderScore !== null
          ? `Compounder Score ${entrada.compounderScore}.`
          : "Compounder sem componentes suficientes.",
    },
    {
      id: "technical",
      nome: "Technical Score",
      peso: CONFLUENCIA_PESOS.technical,
      valor: entrada.technicalScore,
      explicacao:
        entrada.technicalScore !== null
          ? `Technical Score ${entrada.technicalScore}.`
          : "Technical sem componentes suficientes (histórico de preço curto).",
    },
  ];

  const disponiveis = componentes.filter((c) => c.valor !== null);
  const pesoDisponivel = disponiveis.reduce((a, c) => a + c.peso, 0);
  const score =
    disponiveis.length === 0
      ? null
      : Math.round(disponiveis.reduce((a, c) => a + c.valor! * c.peso, 0) / pesoDisponivel);

  const conviccao = classificarConviccao(score, pesoDisponivel);

  return {
    score,
    conviccao,
    componentesDisponiveis: disponiveis.length,
    componentesTotal: componentes.length,
    componentes,
    metodo:
      "Confluence Score v1 — média ponderada de Fundamentos(30%)+Carry(20%)+Compounder(25%)+Technical(25%), peso renormalizado entre os disponíveis. Macro, Fluxo e Gestão ficam de fora (sem proxy numérico honesto hoje — ver roadmap/technical-engine-v1.md). Nunca é recomendação de compra ou venda.",
  };
}

/**
 * CONFLUENCE ENGINE v2 (Foundation v3 — Módulo 2).
 *
 * NÃO substitui a v1 acima — mesma regra de versionamento do Score e do
 * Carry: a anterior nunca é editada, uma nova é adicionada ao lado. A v1
 * continua em produção (usada por /ranking, /comparar, decision-feed etc.)
 * até uma decisão explícita de trocar os call sites (Bloco 2).
 *
 * A especificação do Bloco 1 pediu 8 componentes: Quality, Carry, Growth,
 * Macro, Technical, Consensus, Management, Portfolio. Corte honesto
 * (investigação de 04/08/2026, ver roadmap/foundation-v3.md): hoje só
 * QUALITY, CARRY e TECHNICAL têm motor real por trás. Os outros 5 não têm
 * fonte de dado nem cálculo hoje — entram como pendência explícita (null +
 * motivo por escrito), nunca como número inventado ou peso zero disfarçado.
 * Growth entra pendente mesmo existindo `crescReceitaAnual` dentro do Carry:
 * a especificação pede Growth ISOLADO como componente próprio, o que exigiria
 * um motor separado — decisão de não fabricar esse motor às pressas.
 */

export type ComponenteConfluenciaV2Id =
  | "quality"
  | "carry"
  | "growth"
  | "macro"
  | "technical"
  | "consensus"
  | "management"
  | "portfolio";

export type ComponenteConfluenciaV2 = {
  id: ComponenteConfluenciaV2Id;
  nome: string;
  peso: number;
  valor: number | null;
  explicacao: string;
};

export type ConfluenciaV2Resultado = {
  score: number | null;
  conviccao: Conviccao;
  componentesDisponiveis: number;
  componentesTotal: number;
  componentes: ComponenteConfluenciaV2[];
  metodo: string;
};

/**
 * Pesos provisórios do Bloco 1 — refletem que só 3 dos 8 componentes têm
 * dado real hoje. Como o cálculo renormaliza entre os componentes
 * disponíveis (igual à v1), o resultado de hoje é equivalente a uma média
 * ponderada de Quality/Carry/Technical até que Bloco 2 destrave os demais.
 * Revisar os pesos quando Growth/Macro/Consensus/Management/Portfolio
 * ganharem motor real — não antes, para não fingir precisão que não existe.
 */
export const CONFLUENCIA_V2_PESOS: Record<ComponenteConfluenciaV2Id, number> = {
  quality: 0.25,
  carry: 0.2,
  growth: 0.15,
  technical: 0.2,
  macro: 0.1,
  consensus: 0.05,
  management: 0.03,
  portfolio: 0.02,
};

export type EntradaConfluenciaV2 = {
  /** Quality = combinação de Fundamentos (réguas versionadas) + Compounder, quando disponíveis. */
  fundamentosScore: number | null;
  fundamentosComponentes: number;
  compounderScore: number | null;
  carryReal: number | null;
  technicalScore: number | null;
};

function calcularQualityV2(
  fundamentosScore: number | null,
  fundamentosComponentes: number,
  compounderScore: number | null
): { valor: number | null; explicacao: string } {
  const partes: number[] = [];
  const fontes: string[] = [];
  if (fundamentosComponentes > 0 && fundamentosScore !== null) {
    partes.push(fundamentosScore);
    fontes.push("Fundamentos");
  }
  if (compounderScore !== null) {
    partes.push(compounderScore);
    fontes.push("Compounder");
  }
  if (partes.length === 0) {
    return { valor: null, explicacao: "Sem Fundamentos nem Compounder calculáveis ainda." };
  }
  const media = Math.round(partes.reduce((a, b) => a + b, 0) / partes.length);
  return { valor: media, explicacao: `Quality = média de ${fontes.join(" e ")} (${media}).` };
}

export function calcularConfluenciaV2(entrada: EntradaConfluenciaV2): ConfluenciaV2Resultado {
  const quality = calcularQualityV2(entrada.fundamentosScore, entrada.fundamentosComponentes, entrada.compounderScore);

  const componentes: ComponenteConfluenciaV2[] = [
    {
      id: "quality",
      nome: "Quality (Fundamentos + Compounder)",
      peso: CONFLUENCIA_V2_PESOS.quality,
      valor: quality.valor,
      explicacao: quality.explicacao,
    },
    {
      id: "carry",
      nome: "Carry (melhor degrau calculável)",
      peso: CONFLUENCIA_V2_PESOS.carry,
      valor: entrada.carryReal !== null ? mapaFaixas(entrada.carryReal, CARRY_FAIXAS) : null,
      explicacao:
        entrada.carryReal !== null
          ? `Carry real IPCA + ${(entrada.carryReal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% a.a.`
          : "Carry incalculável para esta empresa.",
    },
    {
      id: "growth",
      nome: "Growth (isolado)",
      peso: CONFLUENCIA_V2_PESOS.growth,
      valor: null,
      explicacao:
        "Sem motor de Growth isolado hoje — a especificação pede um componente próprio, separado do crescimento já embutido no Carry. Pendência documentada para o Bloco 2.",
    },
    {
      id: "technical",
      nome: "Technical Score",
      peso: CONFLUENCIA_V2_PESOS.technical,
      valor: entrada.technicalScore,
      explicacao:
        entrada.technicalScore !== null
          ? `Technical Score ${entrada.technicalScore}.`
          : "Technical sem componentes suficientes (histórico de preço curto).",
    },
    {
      id: "macro",
      nome: "Macro",
      peso: CONFLUENCIA_V2_PESOS.macro,
      valor: null,
      explicacao:
        "Macro existe como CONTEXTO hoje (Focus/Selic/CDI/IPCA) mas não é um score comparável entre empresas. Pendência documentada para o Bloco 2.",
    },
    {
      id: "consensus",
      nome: "Consensus (mercado/analistas)",
      peso: CONFLUENCIA_V2_PESOS.consensus,
      valor: null,
      explicacao: "Nenhuma fonte de consenso de mercado (analistas, fluxo institucional) é coletada hoje. Pendência documentada para o Bloco 2.",
    },
    {
      id: "management",
      nome: "Management",
      peso: CONFLUENCIA_V2_PESOS.management,
      valor: null,
      explicacao: "Mesmo buraco já documentado no Compounder Engine — sem proxy honesto de qualidade de gestão hoje. Pendência documentada para o Bloco 2.",
    },
    {
      id: "portfolio",
      nome: "Portfolio (fit de carteira)",
      peso: CONFLUENCIA_V2_PESOS.portfolio,
      valor: null,
      explicacao:
        "portfolio-health.ts mede a carteira agregada, não a posição isolada — falta regra que traduza fit de carteira em nota por empresa. Pendência documentada para o Bloco 2.",
    },
  ];

  const disponiveis = componentes.filter((c) => c.valor !== null);
  const pesoDisponivel = disponiveis.reduce((a, c) => a + c.peso, 0);
  const score =
    disponiveis.length === 0
      ? null
      : Math.round(disponiveis.reduce((a, c) => a + c.valor! * c.peso, 0) / pesoDisponivel);

  const conviccao = classificarConviccao(score, pesoDisponivel);

  return {
    score,
    conviccao,
    componentesDisponiveis: disponiveis.length,
    componentesTotal: componentes.length,
    componentes,
    metodo:
      "Confluence Score v2 (Foundation v3) — 8 componentes: Quality/Carry/Growth/Macro/Technical/Consensus/Management/Portfolio, peso renormalizado entre os disponíveis. Hoje só Quality, Carry e Technical têm dado real; os outros 5 são pendências documentadas (corte honesto), nunca peso zero disfarçado. Convive com a v1 (não a substitui). Nunca é recomendação de compra ou venda.",
  };
}

