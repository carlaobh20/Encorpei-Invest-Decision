import type { Decision } from "./decision-object";
import type { PerfilTese, StatusDerivadoTese } from "./thesis-engine";
import type { SeveridadeAlerta } from "./alertas";

/**
 * MOTOR DE URGÊNCIA — DECISÕES PRIORITÁRIAS (Bloco 2 — Sprint 2.1, Decision
 * Center, Seção 1).
 *
 * "Foundation oficialmente congelado" (spec do Carlos) — este arquivo NÃO
 * calcula nenhuma nota, Carry, Confluence ou probabilidade nova. Ele só
 * REPRIORIZA/RECLASSIFICA sinais que os motores do Foundation já produziram
 * (`Decision.fdie`, `PerfilTese.thesisStatus`, severidade de alerta já
 * classificada por `alertas.ts`) — mesmo tipo de trabalho de camada de
 * produto que `alertas.ts` já fez no Meu Dash (Sprint 2.1), só que aqui
 * junta os sinais dispersos em UM item acionável por ticker, ordenado por
 * urgência. Nenhum "novo motor de decisão" — é composição/apresentação do
 * que já existe.
 *
 * "Tempo estimado para análise" é um heurística EDITORIAL (não uma medição
 * de tempo real de leitura) — mesmo tipo de corte já usado nos limiares de
 * liquidez em `dash-agregados.ts`: documentado aqui, não escondido.
 */

export type UrgenciaDecisao = "critica" | "alta" | "media" | "baixa";

export const ROTULO_URGENCIA: Record<UrgenciaDecisao, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

/** minutos estimados de leitura/análise por nível — heurística editorial, não medida. */
export const TEMPO_ESTIMADO_MINUTOS: Record<UrgenciaDecisao, number> = {
  critica: 15,
  alta: 10,
  media: 5,
  baixa: 5,
};

/** Vocabulário permitido pela spec (CLAUDE.md regra 7 + spec do Decision Center) — nunca "comprar"/"vender". */
export type AcaoRotulo = "Estudar" | "Revisar" | "Acompanhar" | "Monitorar" | "Reavaliar" | "Aprofundar";

export type EntradaDecisaoPrioritaria = {
  ticker: string;
  empresa: string;
  decision: Decision;
  perfilTese: PerfilTese | null;
  /** severidades de alertas dos últimos eventos deste ticker (já classificadas por alertas.ts) */
  severidadesRecentes: SeveridadeAlerta[];
};

export type DecisaoPrioritaria = {
  ticker: string;
  empresa: string;
  titulo: string;
  urgencia: UrgenciaDecisao;
  probabilidade: number | null;
  probabilidadeMotivo: string | null;
  impactoEsperado: string;
  tempoEstimadoMinutos: number;
  motivo: string;
  acao: AcaoRotulo;
};

const URGENCIA_ORDEM: Record<UrgenciaDecisao, number> = { critica: 0, alta: 1, media: 2, baixa: 3 };

const TITULO_POR_STATUS: Partial<Record<StatusDerivadoTese, string>> = {
  quebrada: "Tese quebrada — decidir o que fazer",
  invalida: "Tese invalidada manualmente — decidir o que fazer",
  enfraquecendo: "Tese enfraquecendo — reavaliar premissas",
  fortalecendo: "Tese fortalecendo — vale aprofundar",
};

/**
 * Classifica a urgência de UM ticker a partir de sinais já calculados.
 * Ordem de prioridade (nunca aumenta por suposição — cai pro nível mais
 * baixo que os sinais disponíveis sustentam): FDIE crítico > tese
 * quebrada/inválida > alerta crítico recente > tese enfraquecendo/alerta
 * importante > tese fortalecendo > resto.
 */
export function classificarUrgencia(entrada: EntradaDecisaoPrioritaria): { urgencia: UrgenciaDecisao; motivo: string; titulo: string } {
  const { decision, perfilTese, severidadesRecentes } = entrada;
  const temCritico = severidadesRecentes.includes("critico");
  const temImportante = severidadesRecentes.includes("importante");

  if (decision.fdie.critico > 0) {
    return {
      urgencia: "critica",
      motivo: `FDIE encontrou ${decision.fdie.critico} verificação(ões) crítica(s) de integridade de dado.`,
      titulo: "Integridade de dado comprometida — checar a fonte",
    };
  }
  if (perfilTese?.thesisStatus === "quebrada" || perfilTese?.thesisStatus === "invalida") {
    return {
      urgencia: "critica",
      motivo: TITULO_POR_STATUS[perfilTese.thesisStatus] ?? "Tese comprometida.",
      titulo: TITULO_POR_STATUS[perfilTese.thesisStatus] ?? "Tese comprometida",
    };
  }
  if (temCritico) {
    return { urgencia: "critica", motivo: "Alerta crítico recente para este ticker.", titulo: "Alerta crítico recente" };
  }
  if (perfilTese?.thesisStatus === "enfraquecendo") {
    return {
      urgencia: "alta",
      motivo: "Tese enfraquecendo — status derivado do Thesis Engine.",
      titulo: TITULO_POR_STATUS.enfraquecendo!,
    };
  }
  if (temImportante) {
    return { urgencia: "alta", motivo: "Alerta importante recente para este ticker.", titulo: "Alerta importante recente" };
  }
  if (perfilTese?.thesisStatus === "fortalecendo") {
    return {
      urgencia: "media",
      motivo: "Tese fortalecendo — pode valer aprofundar a posição ou a tese.",
      titulo: TITULO_POR_STATUS.fortalecendo!,
    };
  }
  return {
    urgencia: "baixa",
    motivo: "Sem sinal de risco ou de fortalecimento identificado — acompanhamento de rotina.",
    titulo: "Acompanhamento de rotina",
  };
}

function acaoPorUrgencia(urgencia: UrgenciaDecisao, thesisStatus: StatusDerivadoTese | null): AcaoRotulo {
  if (urgencia === "critica") return thesisStatus === "invalida" ? "Reavaliar" : "Revisar";
  if (urgencia === "alta") return "Revisar";
  if (urgencia === "media") return "Aprofundar";
  return "Acompanhar";
}

/** Exportado para reuso pelo Decision Panel de Empresas (Sprint 2.2) — mesmo texto, um único lugar que decide como formatar impacto esperado. */
export function impactoEsperadoTexto(decision: Decision): string {
  if (decision.expectedReturn.valor !== null) {
    return `Retorno esperado (12m, Probability V2): ${(decision.expectedReturn.valor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%.`;
  }
  if (decision.carry !== null) {
    return `Carry real: IPCA + ${(decision.carry * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% a.a. — sem retorno esperado por janela histórica ainda (${decision.expectedReturn.motivo ?? "motivo não registrado"}).`;
  }
  return "Sem estimativa de impacto calculável para este ticker ainda — nem Carry, nem Probability V2 disponíveis.";
}

/**
 * Monta a lista de Decisões Prioritárias, ordenada por urgência (nunca por
 * score) e limitada a `max` itens — a spec pede no máximo 5 cards na Seção 1.
 */
export function montarDecisoesPrioritarias(entradas: EntradaDecisaoPrioritaria[], max = 5): DecisaoPrioritaria[] {
  const classificadas = entradas.map((e) => {
    const { urgencia, motivo, titulo } = classificarUrgencia(e);
    return {
      ticker: e.ticker,
      empresa: e.empresa,
      titulo,
      urgencia,
      probabilidade: e.decision.probability?.probabilidade ?? null,
      probabilidadeMotivo: e.decision.probability?.explicacao ?? "Sem decisões registradas o suficiente no Diário para estimar probabilidade histórica.",
      impactoEsperado: impactoEsperadoTexto(e.decision),
      tempoEstimadoMinutos: TEMPO_ESTIMADO_MINUTOS[urgencia],
      motivo,
      acao: acaoPorUrgencia(urgencia, e.perfilTese?.thesisStatus ?? null),
    } satisfies DecisaoPrioritaria;
  });

  return classificadas
    .filter((d) => d.urgencia !== "baixa") // Seção 1 é "o que precisa de decisão" — rotina fica fora, não é irrelevante, é o ponto
    .sort((a, b) => URGENCIA_ORDEM[a.urgencia] - URGENCIA_ORDEM[b.urgencia])
    .slice(0, max);
}
