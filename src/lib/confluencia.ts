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

const CARRY_FAIXAS: [number, number][] = [
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

  let conviccao: Conviccao;
  if (score === null || pesoDisponivel < 0.4) {
    conviccao = "indefinida";
  } else if (score >= 75 && pesoDisponivel >= 0.7) {
    conviccao = "alta";
  } else if (score >= 50) {
    conviccao = "moderada";
  } else {
    conviccao = "baixa";
  }

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

