import type { StatusDerivadoTese } from "@/lib/thesis-engine";

/**
 * ALERTAS COM SEVERIDADE (Bloco 2 — Sprint 2.1, Meu Dash).
 *
 * A spec pede alertas separados por Crítico/Importante/Informativo — nada
 * no sistema classificava severidade até agora (eventos de `eventos_tese`
 * só tinham `tipo`, sem prioridade). Função pura nova, mas reaproveita os
 * SINAIS que já existem (FDIE crítico do Decision Object, `StatusDerivadoTese`
 * do Thesis Engine, direção do gatilho de `gatilhos.direcao`) — não inventa
 * um motor de risco novo, só prioriza o que já é calculado em outro lugar.
 */

export type SeveridadeAlerta = "critico" | "importante" | "informativo";

export const ROTULO_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  critico: "Crítico",
  importante: "Importante",
  informativo: "Informativo",
};

export type TipoEventoAlerta = "gatilho_disparado" | "mudanca_status" | "criacao" | "revisao";

export type EntradaClassificacaoAlerta = {
  tipo: TipoEventoAlerta;
  gatilhoDirecao?: "positivo" | "negativo" | null;
  fdieCritico?: boolean;
  thesisStatus?: StatusDerivadoTese | null;
};

export type ResultadoClassificacaoAlerta = {
  severidade: SeveridadeAlerta;
  motivo: string;
};

/**
 * Classifica a severidade de UM evento/sinal. Ordem de prioridade: FDIE
 * crítico > tese quebrada/inválida > gatilho negativo/tese enfraquecendo >
 * mudança de status genérica > resto (informativo). Nunca aumenta
 * severidade por suposição — na dúvida, cai pro nível mais baixo que os
 * sinais disponíveis sustentam.
 */
export function classificarSeveridadeAlerta(entrada: EntradaClassificacaoAlerta): ResultadoClassificacaoAlerta {
  if (entrada.fdieCritico) {
    return { severidade: "critico", motivo: "FDIE encontrou verificação crítica de integridade de dado para este ticker." };
  }
  if (entrada.thesisStatus === "quebrada") {
    return { severidade: "critico", motivo: "Tese quebrada." };
  }
  if (entrada.thesisStatus === "invalida") {
    return { severidade: "critico", motivo: "Tese invalidada manualmente." };
  }
  if (entrada.tipo === "gatilho_disparado" && entrada.gatilhoDirecao === "negativo") {
    return { severidade: "importante", motivo: "Gatilho de atenção disparou." };
  }
  if (entrada.thesisStatus === "enfraquecendo") {
    return { severidade: "importante", motivo: "Tese enfraquecendo." };
  }
  if (entrada.tipo === "mudanca_status") {
    return { severidade: "importante", motivo: "Status da tese mudou." };
  }
  return { severidade: "informativo", motivo: "Evento sem sinal de risco identificado." };
}

const ORDEM_SEVERIDADE: Record<SeveridadeAlerta, number> = { critico: 0, importante: 1, informativo: 2 };

/** Ordena por severidade (crítico primeiro) — não recalcula severidade, só ordena o que já foi classificado. */
export function ordenarPorSeveridade<T extends { severidade: SeveridadeAlerta }>(alertas: T[]): T[] {
  return [...alertas].sort((a, b) => ORDEM_SEVERIDADE[a.severidade] - ORDEM_SEVERIDADE[b.severidade]);
}

export function contarPorSeveridade(alertas: { severidade: SeveridadeAlerta }[]): Record<SeveridadeAlerta, number> {
  const contagem: Record<SeveridadeAlerta, number> = { critico: 0, importante: 0, informativo: 0 };
  for (const a of alertas) contagem[a.severidade]++;
  return contagem;
}
