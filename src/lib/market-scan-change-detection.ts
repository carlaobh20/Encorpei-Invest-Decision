import { MARKET_SCAN_CONFIG as CFG } from "./market-scan-config";
import type { StatusDerivadoTese } from "./thesis-engine";

/**
 * MARKET SCAN — CHANGE DETECTION (Bloco 2, Sprint 2.10, Módulo 2).
 *
 * "O que realmente mudou desde ontem?" — 13 dimensões pedidas na spec.
 * INVENTÁRIO HONESTO feito antes de codar (mesma disciplina de todo o
 * Bloco 2): nem toda dimensão tem hoje uma fonte de dado histórica real
 * pra comparar "ontem vs hoje". Cada dimensão abaixo está marcada:
 *
 * REAL HOJE (dado histórico já existe em produção, zero coisa nova):
 *  - Tese: `eventos_tese` (migração 004, insert-only, já alimenta os
 *    Alertas do Meu Dash) — mudança de status já é um evento real.
 *  - Carry (v1): `carry_score` (gravado todo dia útil pelo cron
 *    `/api/teses/avaliar` desde antes do Bloco 2) — histórico diário real.
 *    NOTA: é o Carry v1 (piso), não o Carry v2/escada de 5 níveis que o
 *    Decision Object expõe — esse não é persistido diariamente ainda (ver
 *    "PENDENTE DE CAPTURA" abaixo).
 *  - Quality (proxy via tendência de ROIC): mesmo cálculo de variação
 *    relativa que `memory-layer-resultados.ts` já usa pra emitir
 *    evidências — reaproveita o MESMO limiar (`limiarVariacaoRelativa`),
 *    não inventa um segundo.
 *
 * PENDENTE DE CAPTURA (comparador pronto e testado, mas sem dado real até
 * a migração 024 — `decision_snapshot_diario` — ser aplicada e rodar por
 * pelo menos 2 dias): Growth, Portfolio Fit, Convicção, Técnica. Enquanto
 * não há "ontem" pra comparar, a função devolve `disponivel: false` com o
 * motivo — nunca fabrica uma direção.
 *
 * PENDENTE DE POPULAÇÃO (a fonte existe — tabela `evidencias`, migração
 * 021, já aplicada — mas o coletor que a alimenta,
 * `/api/evidencias/coletar`, nunca rodou agendado em produção, migração
 * 023 que ele também escreve ainda não aplicada): Guidance, Governança
 * (regulatório), Controlador, Macro.
 *
 * SEM FONTE NENHUMA HOJE (estrutura preparada, nunca fabricado):
 *  - Fluxo: exatamente como a spec pediu — "estrutura preparada".
 *  - Dividendos: confirmado por busca no código (Sprint 2.9) — o sistema
 *    nunca rastreou proventos recebidos por posição.
 */

export type DimensaoMudanca =
  | "tese" | "carry" | "quality" | "growth" | "portfolio_fit" | "conviccao"
  | "tecnica" | "macro" | "fluxo" | "governanca" | "guidance" | "dividendos" | "controlador";

export type MudancaEvento = {
  ticker: string;
  dimensao: DimensaoMudanca;
  disponivel: boolean;
  motivo: string | null;
  direcao: "melhorou" | "piorou" | "neutro" | null;
  texto: string;
};

function motivoIndisponivelSnapshot(dimensao: string): string {
  return `Sem captura anterior de ${dimensao} ainda — migração 024 (decision_snapshot_diario) precisa estar aplicada e rodar por pelo menos 2 dias antes de comparar.`;
}

function motivoIndisponivelEvidencia(dimensao: string): string {
  return `Fonte existe (tabela evidencias) mas o coletor (/api/evidencias/coletar) nunca rodou agendado em produção — sem evidências novas de ${dimensao} pra comparar.`;
}

// ---------- REAL HOJE ----------

export type EventoTeseRow = { ticker: string; tipo: string; criado_em: string; descricao?: string | null };

/** Reaproveita eventos_tese (já real, já alimenta Alertas) — nunca recalcula, só traduz pro vocabulário do Market Scan. */
export function detectarMudancaTese(ticker: string, eventosRecentes: EventoTeseRow[]): MudancaEvento | null {
  const doTicker = eventosRecentes.filter((e) => e.ticker === ticker);
  if (doTicker.length === 0) return null;
  const gatilho = doTicker.find((e) => e.tipo === "gatilho_disparado");
  const mudancaStatus = doTicker.find((e) => e.tipo === "mudanca_status");
  const evento = mudancaStatus ?? gatilho ?? doTicker[0];
  return {
    ticker,
    dimensao: "tese",
    disponivel: true,
    motivo: null,
    direcao: evento.tipo === "gatilho_disparado" ? "piorou" : "neutro",
    texto: evento.descricao ?? `Evento de tese registrado: ${evento.tipo}.`,
  };
}

/** Carry v1 (carry_score), histórico diário real desde antes do Bloco 2. */
export function detectarMudancaCarryV1(ticker: string, carryOntem: number | null, carryHoje: number | null): MudancaEvento | null {
  if (carryOntem === null || carryHoje === null) return null;
  const delta = carryHoje - carryOntem;
  if (Math.abs(delta) < CFG.limiarDeltaCarryPP) return null;
  return {
    ticker,
    dimensao: "carry",
    disponivel: true,
    motivo: null,
    direcao: delta > 0 ? "melhorou" : "piorou",
    texto: `Carry (v1) ${delta > 0 ? "subiu" : "caiu"} ${(Math.abs(delta) * 100).toFixed(1)}pp desde ontem.`,
  };
}

/** Proxy de Quality via tendência de ROIC — mesmo limiar de memory-layer-resultados.ts, não um segundo motor. */
export function detectarMudancaQualityViaRoic(ticker: string, roicAnterior: number | null, roicAtual: number | null): MudancaEvento | null {
  if (roicAnterior === null || roicAtual === null || roicAnterior === 0) return null;
  const variacaoRelativa = (roicAtual - roicAnterior) / Math.abs(roicAnterior);
  if (Math.abs(variacaoRelativa) < CFG.limiarVariacaoRelativa) return null;
  return {
    ticker,
    dimensao: "quality",
    disponivel: true,
    motivo: null,
    direcao: variacaoRelativa > 0 ? "melhorou" : "piorou",
    texto: `ROIC (proxy de Quality) ${variacaoRelativa > 0 ? "melhorou" : "piorou"} ${(Math.abs(variacaoRelativa) * 100).toFixed(0)}% na comparação disponível.`,
  };
}

// ---------- PENDENTE DE CAPTURA (snapshot v2) ----------

export type SnapshotV2Campo = "growth" | "portfolio_fit" | "conviccao" | "tecnica";

/** Comparador genérico, pronto e testado — só produz resultado real quando `ontem` existir (pós migração 024 + 2 capturas). */
export function detectarMudancaSnapshotV2(
  ticker: string,
  campo: SnapshotV2Campo,
  ontem: number | null,
  hoje: number | null
): MudancaEvento {
  if (ontem === null) {
    return { ticker, dimensao: campo, disponivel: false, motivo: motivoIndisponivelSnapshot(campo), direcao: null, texto: "" };
  }
  if (hoje === null) {
    return { ticker, dimensao: campo, disponivel: false, motivo: `Valor de hoje indisponível para ${campo}.`, direcao: null, texto: "" };
  }
  const delta = hoje - ontem;
  if (Math.abs(delta) < 1e-9) {
    return { ticker, dimensao: campo, disponivel: true, motivo: null, direcao: "neutro", texto: `${campo} sem mudança desde ontem.` };
  }
  return {
    ticker,
    dimensao: campo,
    disponivel: true,
    motivo: null,
    direcao: delta > 0 ? "melhorou" : "piorou",
    texto: `${campo} ${delta > 0 ? "subiu" : "caiu"} ${Math.abs(delta).toFixed(1)} pontos desde ontem.`,
  };
}

// ---------- PENDENTE DE POPULAÇÃO (evidências) ----------

export type EvidenciaNovaRow = { ticker: string; categoria: string; descricao: string; criado_em: string };

const CATEGORIA_POR_DIMENSAO: Record<"guidance" | "governanca" | "controlador" | "macro", string[]> = {
  guidance: ["guidance"],
  governanca: ["regulatorio"],
  controlador: ["controlador_venda"],
  macro: ["macro_focus", "macro_selic"],
};

export function detectarMudancaPorEvidencia(
  ticker: string,
  dimensao: "guidance" | "governanca" | "controlador" | "macro",
  evidenciasNovas: EvidenciaNovaRow[]
): MudancaEvento {
  const categorias = CATEGORIA_POR_DIMENSAO[dimensao];
  const relevantes = evidenciasNovas.filter((e) => e.ticker === ticker && categorias.includes(e.categoria));
  if (relevantes.length === 0) {
    return { ticker, dimensao, disponivel: false, motivo: motivoIndisponivelEvidencia(dimensao), direcao: null, texto: "" };
  }
  return {
    ticker,
    dimensao,
    disponivel: true,
    motivo: null,
    direcao: "neutro",
    texto: relevantes[0].descricao,
  };
}

// ---------- SEM FONTE NENHUMA HOJE ----------

export function detectarMudancaFluxo(ticker: string): MudancaEvento {
  return {
    ticker,
    dimensao: "fluxo",
    disponivel: false,
    motivo: "Estrutura preparada (ver ENTREGA da spec) — sem fonte de dado de fluxo institucional/estrangeiro hoje.",
    direcao: null,
    texto: "",
  };
}

export function detectarMudancaDividendos(ticker: string): MudancaEvento {
  return {
    ticker,
    dimensao: "dividendos",
    disponivel: false,
    motivo: "Sistema não rastreia proventos recebidos por posição — nenhuma coleta existe hoje (confirmado por busca no código, Sprint 2.9).",
    direcao: null,
    texto: "",
  };
}

export type StatusTeseAnteriorAtual = { anterior: StatusDerivadoTese | null; atual: StatusDerivadoTese };
