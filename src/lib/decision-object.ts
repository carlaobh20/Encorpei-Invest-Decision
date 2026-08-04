import type { ResultadoMasterEngine } from "./master-engine";
import type { ComponenteConfluenciaV2Id, Conviccao } from "./confluencia";
import { modeloDe, type ModeloAnalise } from "./setores";
import type { ResultadoProbabilidade } from "./probability-engine";
import type { ResultadoProbabilidadeV2 } from "./probability-engine-v2";
import { estimativaIndisponivel, type EstimativaComIntervalo } from "./estimativa";
import { evidenciasAtivasDoTicker, type Evidencia } from "./evidence";
import { gerarExplicacaoDecisao, type ExplicacaoDecisao } from "./decision-explanation";
import type { NivelConfianca } from "./proveniencia";

/**
 * DECISION OBJECT (Foundation v3.1 — Módulo 1).
 *
 * "A linguagem oficial do sistema" — um único formato de saída que qualquer
 * motor pode alimentar ou consumir. Este arquivo só MONTA o objeto a partir
 * do que os outros motores já calcularam (Master Engine, Confluence v2,
 * Carry, Probability v1/v2, Evidence, Explanation) — nenhuma conta nova
 * acontece aqui.
 *
 * DECISÃO ARQUITETURAL EXPLÍCITA (mesmo espírito do Bloco 1): este objeto
 * existe e está pronto para ser a saída de qualquer rota, mas NINGUÉM foi
 * ligado a ele ainda — nenhuma tela consome `Decision` hoje. Isso é
 * intencional (a especificação pede "não ligar ainda os motores ao
 * Dashboard") e fica registrado como pendência do Bloco 2, não como
 * trabalho esquecido.
 *
 * Campos que a especificação pediu mas que hoje não têm motor real por
 * trás (`growth`, `macro`, `consensus`, `management`, `portfolioFit`,
 * `risk`) seguem o mesmo corte honesto do resto do sistema: `null` +
 * motivo, nunca um número inventado — o motivo mora em `explanation.avisos`
 * (para os componentes do Confluence) ou em `risk.motivo` (caso específico,
 * sem componente de Confluence equivalente).
 */

export type CamposConfidenceInterval = {
  intervaloInferior: number | null;
  intervaloSuperior: number | null;
  nivelConfianca: number | null;
  motivo: string | null;
};

export type Decision = {
  empresa: string;
  ticker: string;
  setor: string | null;
  modeloNegocio: ModeloAnalise | null;
  confluence: number | null;
  conviccao: Conviccao;
  carry: number | null;
  /** Carry Floor (nível 1 da escada) — sempre calculável quando há lucro e valor de mercado */
  carryFloor: number | null;
  /** Retorno Intrínseco (nível 5 da escada) — hoje sempre null, ver src/lib/carry/escada.ts */
  carryExpected: number | null;
  quality: number | null;
  growth: number | null;
  technical: number | null;
  macro: number | null;
  consensus: number | null;
  management: number | null;
  portfolioFit: number | null;
  /** Probability Engine v1 — julga decisões já tomadas pelo investidor (decision-history.ts) */
  probability: ResultadoProbabilidade | null;
  /** Probability Engine v2 — janelas históricas de preço vs. CDI/Ibovespa por horizonte (extra, além do exemplo conceitual pedido) */
  probabilityHistorica: ResultadoProbabilidadeV2 | null;
  /** Espelha o intervalo do expectedReturn (horizonte de 12 meses) — não é um segundo cálculo estatístico independente */
  confidenceInterval: CamposConfidenceInterval;
  expectedReturn: EstimativaComIntervalo;
  expectedDrawdown: EstimativaComIntervalo;
  risk: { nivel: NivelConfianca | null; motivo: string | null };
  fdie: { ok: number; alerta: number; critico: number; total: number };
  evidences: Evidencia[];
  explanation: ExplicacaoDecisao;
  warnings: string[];
  blockingReasons: string[];
  generatedAt: string;
  version: number;
};

export const DECISION_OBJECT_VERSAO = 1;

export type EntradaDecisionObject = {
  resultado: ResultadoMasterEngine;
  empresa: string;
  setor: string | null;
  /** todas as evidências conhecidas (não só as deste ticker) — filtradas internamente */
  evidencias?: Evidencia[];
  probabilidadeV2?: ResultadoProbabilidadeV2 | null;
};

function valorComponente(resultado: ResultadoMasterEngine, id: ComponenteConfluenciaV2Id): number | null {
  return resultado.confluence.componentes.find((c) => c.id === id)?.valor ?? null;
}

/** Monta o Decision Object a partir de um ResultadoMasterEngine já calculado. Função pura — sem I/O, sem recálculo. */
export function montarDecision(entrada: EntradaDecisionObject, generatedAt: string): Decision {
  const { resultado } = entrada;
  const modeloNegocio = modeloDe(resultado.ticker);
  const evidenciasDoTicker = evidenciasAtivasDoTicker(resultado.ticker, entrada.evidencias ?? []);
  const explanation = gerarExplicacaoDecisao(resultado, generatedAt, { evidenciasAtivas: evidenciasDoTicker });

  const floorDegrau = resultado.carry.degraus[0];
  const intrinsecoDegrau = resultado.carry.degraus[4];

  const probabilidadeV2 = entrada.probabilidadeV2 ?? null;
  const horizonte12 = probabilidadeV2?.horizontes[12] ?? null;
  const motivoSemHorizonte12 =
    "Sem Probability Engine V2 calculada para este ticker, ou horizonte de 12 meses ainda não destravado (poucos anos de histórico de preço) — ver probability-engine-v2.ts.";
  const expectedReturn = horizonte12?.retornoEsperado ?? estimativaIndisponivel(motivoSemHorizonte12);
  const expectedDrawdown = horizonte12?.drawdownEsperado ?? estimativaIndisponivel(motivoSemHorizonte12);

  const blockingReasons: string[] = [];
  if (resultado.decisao.bloqueadaPorFdie) {
    blockingReasons.push(
      `FDIE encontrou ${resultado.fdie.resumo.critico} verificação(ões) crítica(s) — checar a fonte antes de confiar em qualquer nota deste ciclo.`
    );
  }
  if (resultado.confluence.score === null) {
    blockingReasons.push("Confluence indisponível — nenhum componente calculável ainda para este ticker.");
  }

  // warnings = tudo que a Explanation já levantou, menos o que virou blockingReason (evita repetir o mesmo texto nos dois lugares)
  const warnings = explanation.avisos.filter((a) => !blockingReasons.includes(a));

  return {
    empresa: entrada.empresa,
    ticker: resultado.ticker,
    setor: entrada.setor,
    modeloNegocio,
    confluence: resultado.confluence.score,
    conviccao: resultado.confluence.conviccao,
    carry: resultado.carry.melhor.resultado?.carryReal ?? null,
    carryFloor: floorDegrau.resultado?.carryReal ?? null,
    carryExpected: intrinsecoDegrau.resultado?.carryReal ?? null,
    quality: valorComponente(resultado, "quality"),
    growth: valorComponente(resultado, "growth"),
    technical: valorComponente(resultado, "technical"),
    macro: valorComponente(resultado, "macro"),
    consensus: valorComponente(resultado, "consensus"),
    management: valorComponente(resultado, "management"),
    portfolioFit: valorComponente(resultado, "portfolio"),
    probability: resultado.probabilidade,
    probabilityHistorica: probabilidadeV2,
    confidenceInterval: {
      intervaloInferior: expectedReturn.intervaloInferior,
      intervaloSuperior: expectedReturn.intervaloSuperior,
      nivelConfianca: expectedReturn.nivelConfianca,
      motivo: expectedReturn.motivo,
    },
    expectedReturn,
    expectedDrawdown,
    risk: {
      nivel: null,
      motivo:
        "Sem motor de risco dedicado ainda — FDIE (integridade do dado) e o drawdown esperado (Probability V2) são os proxies parciais disponíveis hoje. Pendência documentada para o Bloco 2.",
    },
    fdie: resultado.fdie.resumo,
    evidences: evidenciasDoTicker,
    explanation,
    warnings,
    blockingReasons,
    generatedAt,
    version: DECISION_OBJECT_VERSAO,
  };
}
