import type { DecisaoPrioritaria } from "./decisoes-prioritarias";

/**
 * QUICK ACTIONS (Bloco 2, Sprint 2.8, Wealth Operating System — Seção 11).
 *
 * "Nenhuma lógica duplicada... Tudo vindo do Decision Center." — este
 * arquivo NÃO reclassifica urgência: só agrupa `DecisaoPrioritaria[]` (já
 * produzida por `montarDecisoesPrioritarias`, decisoes-prioritarias.ts) em
 * 3 baldes de prazo. `baixa` urgência ("acompanhamento de rotina", pelo
 * próprio rótulo de `classificarUrgencia`) fica FORA da fila de trabalho —
 * não é uma ação pendente, é a ausência de uma.
 */

export type BaldeQuickAction = "hoje" | "esta_semana" | "este_mes";

export const ROTULO_BALDE: Record<BaldeQuickAction, string> = {
  hoje: "Hoje",
  esta_semana: "Esta semana",
  este_mes: "Este mês",
};

export function bucketizarQuickActions(decisoes: DecisaoPrioritaria[]): Record<BaldeQuickAction, DecisaoPrioritaria[]> {
  const baldes: Record<BaldeQuickAction, DecisaoPrioritaria[]> = { hoje: [], esta_semana: [], este_mes: [] };
  for (const d of decisoes) {
    if (d.urgencia === "critica") baldes.hoje.push(d);
    else if (d.urgencia === "alta") baldes.esta_semana.push(d);
    else if (d.urgencia === "media") baldes.este_mes.push(d);
    // "baixa" fica de fora deliberadamente — rotina, não fila de trabalho.
  }
  return baldes;
}
