import { detectarNovoBalanco, detectarMudancaNota, type EventoTimelineDetectado } from "./decision-timeline";

/**
 * ACTION TIMELINE (Bloco 2 — Sprint 2.1, Decision Center, Seção 6).
 *
 * SUBSTITUIÇÃO HONESTA registrada com o Carlos antes de codar: a spec pede
 * 6 tipos de evento (Novo balanço, Novo Focus, Mudança de Selic, Controlador
 * comprando, Novo guidance, Novo consenso). `decision-timeline.ts`
 * (Foundation v3) já documenta que só 2 desses têm detector real hoje —
 * "novo balanço" (competência nova em `fundamentos`) e, por extensão, nota
 * oficial mudando (`mudanca_nota`, mesmo motor do Thesis Monitor acima).
 * Focus/Selic mudam mas não têm detector dedicado (só valor bruto salvo);
 * "controlador comprando"/"guidance"/"consenso" não têm NENHUMA fonte de
 * dado coletada (ver evidence.ts, `CATEGORIAS_COM_FONTE_HOJE`). Em vez de
 * fabricar os 4 tipos que faltam, esta tela mostra os 2 reais (balanço +
 * nota) MAIS os eventos que já são reais e já existem em produção desde o
 * Meu Dash — `eventos_tese` (gatilho disparado / mudança de status),
 * também timestampados de verdade. Zero tipo de evento inventado.
 *
 * `novo_balanco` e `mudanca_nota` são detectados NA HORA (comparando a
 * competência/nota mais recente com a anterior) — o sistema não persiste
 * "quando eu descobri essa mudança", só o próprio fato. Por isso entram na
 * timeline com `criadoEm = geradoEm` (o momento em que esta página rodou),
 * nunca uma data fabricada — rotulado como "detectado agora" na UI.
 */

export type TipoEventoAcaoTimeline = "novo_balanco" | "mudanca_nota" | "gatilho_disparado" | "mudanca_status";

export type EventoAcaoTimeline = {
  ticker: string;
  tipo: TipoEventoAcaoTimeline;
  explicacao: string;
  criadoEm: string;
  /** true = detectado agora comparando snapshots (balanço/nota); false = evento já persistido com timestamp real */
  detectadoAgora: boolean;
};

export type EntradaBalanco = { ticker: string; competenciaAnterior: string | null; competenciaAtual: string };
export type EntradaNota = { ticker: string; notaAnterior: number | null; notaAtual: number | null };
export type EventoExistente = { ticker: string; tipo: "gatilho_disparado" | "mudanca_status"; explicacao: string; criadoEm: string };

function comTicker(ticker: string, ev: EventoTimelineDetectado): { ticker: string; ev: EventoTimelineDetectado } {
  return { ticker, ev };
}

/** Compõe a Action Timeline a partir de detectores reais (decision-timeline.ts) + eventos já persistidos (eventos_tese). Função pura. */
export function montarActionTimeline(
  balancos: EntradaBalanco[],
  notas: EntradaNota[],
  eventosExistentes: EventoExistente[],
  geradoEm: string,
  max = 12
): EventoAcaoTimeline[] {
  const detectados: { ticker: string; ev: EventoTimelineDetectado }[] = [];

  for (const b of balancos) {
    const ev = detectarNovoBalanco(b.ticker, b.competenciaAnterior, b.competenciaAtual);
    if (ev) detectados.push(comTicker(b.ticker, ev));
  }
  for (const n of notas) {
    const ev = detectarMudancaNota(n.ticker, n.notaAnterior, n.notaAtual);
    if (ev) detectados.push(comTicker(n.ticker, ev));
  }

  const eventos: EventoAcaoTimeline[] = [
    ...detectados.map(({ ticker, ev }) => ({
      ticker,
      tipo: ev.tipo as TipoEventoAcaoTimeline,
      explicacao: ev.explicacao,
      criadoEm: geradoEm,
      detectadoAgora: true,
    })),
    ...eventosExistentes.map((e) => ({
      ticker: e.ticker,
      tipo: e.tipo,
      explicacao: e.explicacao,
      criadoEm: e.criadoEm,
      detectadoAgora: false,
    })),
  ];

  return eventos.sort((a, b) => new Date(b.criadoEm).getTime() - new Date(a.criadoEm).getTime()).slice(0, max);
}
