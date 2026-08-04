/**
 * SISTEMA DE CORES (Bloco 2, Sprint 2.5, Módulo "Sistema de Cores" —
 * Simplicity Layer).
 *
 * 6 estados canônicos — QUALQUER tela que precisar de cor de status
 * deveria mapear seu próprio estado local para um destes 6, nunca inventar
 * uma 7ª cor. "Nunca usar vermelho para oscilação normal" é a regra mais
 * fácil de violar sem querer — por isso os mapeamentos de conveniência
 * abaixo (severidade do FDIE, urgência do Decision Center, tendência de
 * nota) já vêm prontos, pra reduzir a chance de alguém escolher vermelho
 * "porque parecia importante".
 */

export type EstadoCor = "cinza" | "azul" | "verde" | "amarelo" | "laranja" | "vermelho";

export const ROTULO_ESTADO_COR: Record<EstadoCor, string> = {
  cinza: "Sem informação",
  azul: "Monitorar",
  verde: "Favorável",
  amarelo: "Atenção",
  laranja: "Revisar",
  vermelho: "Crítico",
};

/** Classes Tailwind prontas — mesmo tom "dark glass" já usado nas telas existentes (Shell, Decision Center, Empresas). */
export const CLASSE_ESTADO_COR: Record<EstadoCor, string> = {
  cinza: "text-slate-400 bg-white/[0.03] border-white/10",
  azul: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  verde: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  amarelo: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  laranja: "text-orange-300 bg-orange-500/10 border-orange-500/30",
  vermelho: "text-red-300 bg-red-500/10 border-red-500/30",
};

/** FDIE (auditoria.ts) já usa 3 níveis — mapeamento direto, sem inventar. */
export function corDeSeveridadeFdie(severidade: "ok" | "alerta" | "critico"): EstadoCor {
  if (severidade === "critico") return "vermelho";
  if (severidade === "alerta") return "amarelo";
  return "verde";
}

/** Decisões Prioritárias (decisoes-prioritarias.ts) já usa 4 níveis de urgência. */
export function corDeUrgencia(urgencia: "critica" | "alta" | "media" | "baixa"): EstadoCor {
  if (urgencia === "critica") return "vermelho";
  if (urgencia === "alta") return "laranja";
  if (urgencia === "media") return "azul";
  return "cinza";
}

/** Thesis Monitor (thesis-monitor-dados.ts) já usa 3 tendências. "estavel" é cinza, não amarelo — mudança pequena não é atenção. */
export function corDeTendenciaNota(tendencia: "subindo" | "descendo" | "estavel"): EstadoCor {
  if (tendencia === "subindo") return "verde";
  if (tendencia === "descendo") return "amarelo";
  return "cinza";
}
