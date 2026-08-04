import type { DecisaoPrioritaria } from "./decisoes-prioritarias";

/**
 * DECISION LESSONS (Bloco 2, Sprint 2.7, Investment Coach Layer — Decision
 * Center: "Por que esta decisão apareceu? Qual conceito ela ensina?").
 *
 * "Por que apareceu" é sempre o `motivo` que `classificarUrgencia`
 * (decisoes-prioritarias.ts, Sprint 2.1) já produz — texto 100% real,
 * nenhuma frase nova. "Conceito que ensina" é uma tabela de tradução
 * FECHADA: `classificarUrgencia` só produz 7 títulos possíveis (união
 * exaustiva, ver o arquivo original) — mapear cada um pra um conceito de
 * investidor é uma tradução determinística de um conjunto fechado, não
 * uma inferência nova.
 */

export type DecisionLesson = {
  porQueApareceu: string;
  conceito: string;
};

const CONCEITO_POR_TITULO: Record<string, string> = {
  "Integridade de dado comprometida — checar a fonte":
    "Antes de julgar uma tese, confirme que o dado por trás dela é confiável — uma métrica errada pode parecer um sinal de qualquer coisa.",
  "Tese quebrada — decidir o que fazer":
    "Uma tese quebrada significa que a premissa original deixou de ser verdade — a decisão não é sobre o preço da ação, é sobre se a história ainda existe.",
  "Tese invalidada manualmente — decidir o que fazer":
    "Invalidar manualmente é admitir que a tese original estava errada — vale registrar por que, pra não repetir o mesmo erro de leitura depois.",
  "Tese enfraquecendo — reavaliar premissas":
    "Um enfraquecimento gradual costuma aparecer antes de uma quebra — reavaliar premissas cedo é mais barato que reagir depois que a tese já quebrou.",
  "Alerta crítico recente":
    "Um alerta crítico isolado nem sempre muda a tese — mas ignorar um padrão de alertas críticos recorrentes costuma ser onde teses se sustentam por inércia, não por fundamento.",
  "Alerta importante recente":
    "Alertas importantes são o meio-termo entre ruído e crise — vale entender o que mudou antes de decidir se é ruído ou início de um padrão.",
  "Tese fortalecendo — vale aprofundar":
    "Fortalecimento é o momento de aprofundar a tese, não de parar de questioná-la — a mesma disciplina que evita perder dinheiro em tese fraca evita convicção excessiva em tese forte.",
  "Acompanhamento de rotina":
    "Sem sinal de risco ou de força não significa que não há nada a aprender — é o momento mais barato para revisar premissas com calma, sem pressão de um evento.",
};

const CONCEITO_PADRAO =
  "Toda decisão prioritária existe porque algum sinal já calculado pelo sistema mudou — vale sempre confirmar qual foi o sinal antes de agir.";

export function gerarDecisionLesson(decisao: Pick<DecisaoPrioritaria, "titulo" | "motivo">): DecisionLesson {
  return {
    porQueApareceu: decisao.motivo,
    conceito: CONCEITO_POR_TITULO[decisao.titulo] ?? CONCEITO_PADRAO,
  };
}
