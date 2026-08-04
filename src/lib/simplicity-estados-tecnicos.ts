/**
 * ESTADOS DE ANÁLISE TÉCNICA (Bloco 2, Sprint 2.5, Módulo "Análise Técnica"
 * — Simplicity Layer).
 *
 * Tensão real com "esta sprint NÃO cria indicadores", resolvida ANTES de
 * codar: `tecnica.ts` devolve uma LISTA de leituras (RSI, tendência,
 * distância da máxima, variação mensal) — combinar essas 4 leituras num
 * único estado seria inventar uma fórmula de agregação nova, proibido
 * nesta sprint. A saída: `technicalScore` (0-100) JÁ é a agregação — é um
 * componente do Confluence v2 (`confluencia.ts`, peso 20-25% conforme a
 * versão), calculado pelo Foundation, não por este arquivo. Este módulo só
 * rotula esse número já existente — não cria indicador, traduz um em
 * vocabulário.
 *
 * `null` (sem histórico de preço suficiente) sempre vira "Sem sinal" —
 * nunca "Monitorando" ou qualquer estado que sugira que existe leitura.
 */

export type EstadoTecnico = "sem_sinal" | "monitorando" | "sinal_inicial" | "boa_oportunidade" | "alta_conviccao" | "conviccao_maxima";

export const ROTULO_ESTADO_TECNICO: Record<EstadoTecnico, string> = {
  sem_sinal: "Sem sinal",
  monitorando: "Monitorando",
  sinal_inicial: "Sinal Inicial",
  boa_oportunidade: "Boa Oportunidade",
  alta_conviccao: "Alta Convicção",
  conviccao_maxima: "Convicção Máxima",
};

/**
 * Mapeia `technicalScore` (0-100, componente já existente do Confluence)
 * pro estado de exibição. Limiares deliberadamente conservadores — "Boa
 * Oportunidade" e acima exigem score alto, "Convicção Máxima" técnica é
 * tão rara quanto a de Confluence (score >= 95).
 */
export function classificarEstadoTecnico(technicalScore: number | null): EstadoTecnico {
  if (technicalScore === null) return "sem_sinal";
  if (technicalScore >= 95) return "conviccao_maxima";
  if (technicalScore >= 80) return "alta_conviccao";
  if (technicalScore >= 65) return "boa_oportunidade";
  if (technicalScore >= 45) return "sinal_inicial";
  return "monitorando";
}
