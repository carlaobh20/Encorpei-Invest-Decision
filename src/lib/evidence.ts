import { hashPayload, type NivelConfianca } from "./proveniencia";

/**
 * EVIDENCE ENGINE (Foundation v3.1 — Módulo 3).
 *
 * Decisão arquitetural (documentada): diferente do Decision Journal e da
 * Decision Timeline (Bloco 1), que reaproveitaram tabelas já existentes,
 * Evidência é um conceito novo — fato bruto observado sobre uma empresa,
 * sem depender de tese ou decisão registrada. Ganhou tabela própria
 * (`evidencias`, migração 021), imutável pelo mesmo padrão do resto do
 * sistema (nunca apagar — `status` muda quando uma evidência é substituída
 * ou contestada por informação mais nova).
 *
 * Regra central da especificação, repetida aqui: "não calcular score, não
 * calcular notas — tudo deve ser armazenado como evidência". Este módulo
 * NUNCA produz uma nota 0-100. `pesoInformativo` é um sinal (favorável/
 * desfavorável) com magnitude — não uma pontuação; nenhum código aqui soma
 * pesos para produzir "a nota da empresa". Os motores que quiserem usar
 * evidência como insumo (Explanation Engine, futuros) decidem o que fazer
 * com ela — este módulo só guarda e resume.
 *
 * Corte honesto: das categorias de exemplo na especificação, hoje o sistema
 * só tem fonte de dado coletada para uma fração pequena (ver
 * `CATEGORIAS_COM_FONTE_HOJE` abaixo). As demais (compra de CEO, venda de
 * controlador, novo guidance, mudança regulatória, fluxo comprador,
 * consenso revisado) não têm coleta automática — evidências nessas
 * categorias só entram se registradas manualmente. A infraestrutura aceita
 * as 12 categorias da especificação; o COLETOR automático de cada uma é
 * trabalho futuro, não deste Bloco.
 *
 * Foundation v4 (Módulo 2, Cause & Effect Engine) acrescentou a categoria
 * `custos` — não estava na lista original, mas o exemplo de árvore causal
 * da própria especificação ("Margem caiu → Custos aumentaram → Matéria-prima
 * encareceu") não tinha categoria de evidência correspondente. Mudança
 * aditiva (união de tipos), não quebra nada que já usava `EvidenciaCategoria`.
 */

export type EvidenciaCategoria =
  | "insider_compra" // CEO/executivo comprando ações
  | "insider_venda" // CEO/executivo vendendo ações
  | "controlador_venda" // controlador vendeu participação
  | "margem" // margem aumentou/caiu
  | "roic" // ROIC caiu/subiu
  | "receita" // receita acelerou/desacelerou
  | "custos" // custos/insumos (ex.: matéria-prima) subiram/caíram — adicionada no Foundation v4 (Cause & Effect Engine) para dar profundidade ao exemplo Carry→Lucro→Margem→Custos da especificação
  | "guidance" // novo guidance da empresa
  | "regulatorio" // mudança regulatória
  | "macro_focus" // novo relatório Focus
  | "macro_selic" // mudança na Selic
  | "fluxo" // fluxo comprador/vendedor (institucional/estrangeiro)
  | "consenso" // consenso de mercado revisado
  | "outro";

/**
 * Categorias com fonte de dado real coletada hoje (04/08/2026) — as demais
 * (9 das 12) existem na infraestrutura mas dependem de registro manual ou
 * de um coletor futuro. Ver auditoria do FDIE (`auditoria.ts`) e do Focus
 * (`macro_focus.json`, coleta já existente no cron diário).
 */
export const CATEGORIAS_COM_FONTE_HOJE: readonly EvidenciaCategoria[] = ["margem", "roic", "receita", "macro_focus", "macro_selic"];

export type EvidenciaStatus = "ativa" | "supersedida" | "refutada";

export type Evidencia = {
  ticker: string;
  categoria: EvidenciaCategoria;
  origem: string;
  /** data do FATO observado (competência do balanço, data da compra do insider etc.) — não a data de coleta */
  data: string;
  /** sinal = favorável (+) ou desfavorável (-); magnitude = intensidade informativa. Nunca é score. */
  pesoInformativo: number;
  confiabilidade: NivelConfianca;
  descricao: string;
  timestamp: string;
  hash: string;
  status: EvidenciaStatus;
};

export type EntradaEvidencia = {
  ticker: string;
  categoria: EvidenciaCategoria;
  origem: string;
  data: string;
  pesoInformativo: number;
  confiabilidade: NivelConfianca;
  descricao: string;
  /** payload bruto do fato, usado só para o hash — nunca alterado depois */
  payload: unknown;
};

/** Monta uma evidência nova — sempre nasce com status "ativa". Função pura; `timestamp` é sempre injetado. */
export function montarEvidencia(entrada: EntradaEvidencia, timestamp: string): Evidencia {
  return {
    ticker: entrada.ticker,
    categoria: entrada.categoria,
    origem: entrada.origem,
    data: entrada.data,
    pesoInformativo: entrada.pesoInformativo,
    confiabilidade: entrada.confiabilidade,
    descricao: entrada.descricao,
    timestamp,
    hash: hashPayload(entrada.payload),
    status: "ativa",
  };
}

export type ResumoEvidenciasTicker = {
  ticker: string;
  total: number;
  ativas: number;
  /** soma de pesoInformativo das evidências ATIVAS — sinal informativo agregado, nunca chamar de "nota" ou "score" */
  somaPesoInformativoAtivas: number;
  porCategoria: Partial<Record<EvidenciaCategoria, number>>;
};

/** Filtro puro reaproveitado por qualquer motor que só deva enxergar evidência viva de um ticker (Explanation Engine, Decision Object). */
export function evidenciasAtivasDoTicker(ticker: string, evidencias: Evidencia[]): Evidencia[] {
  return evidencias.filter((e) => e.ticker === ticker && e.status === "ativa");
}

/** Agrega evidências de um ticker — só soma o que está "ativa" (supersedida/refutada não contam mais). Nunca calcula nota. */
export function resumirEvidenciasPorTicker(ticker: string, evidencias: Evidencia[]): ResumoEvidenciasTicker {
  const doTicker = evidencias.filter((e) => e.ticker === ticker);
  const ativas = evidenciasAtivasDoTicker(ticker, evidencias);
  const porCategoria: Partial<Record<EvidenciaCategoria, number>> = {};
  for (const e of ativas) {
    porCategoria[e.categoria] = (porCategoria[e.categoria] ?? 0) + 1;
  }
  return {
    ticker,
    total: doTicker.length,
    ativas: ativas.length,
    somaPesoInformativoAtivas: ativas.reduce((a, e) => a + e.pesoInformativo, 0),
    porCategoria,
  };
}
