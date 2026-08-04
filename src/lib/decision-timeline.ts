/**
 * DECISION TIMELINE (Foundation v3 — Módulo 6).
 *
 * Decisão arquitetural (documentada, não escondida — ver migração 020):
 * reaproveita `eventos_tese` (imutável desde a migração 004) em vez de criar
 * uma segunda tabela. Este arquivo traz só a lógica pura de DETECÇÃO —
 * compara um estado "antes" com um "depois" e decide se aconteceu algo que
 * mereça virar evento na timeline. Nenhuma função aqui grava no banco
 * (isso é encanamento de rota, fora do domínio).
 *
 * Corte honesto: dos 6 tipos de mudança pedidos na especificação, 3 têm
 * detector aqui (nota, carry, técnica) porque já existem números para
 * comparar. "Novo balanço" também tem detector (é factual: chegou
 * competência nova ou não). "Mudança de confluence" tem detector porque o
 * Módulo 2 (Confluence v2) já produz o score. "Macro", "novo controlador" e
 * "mudança de consenso" NÃO têm detector — sem fonte de dado hoje (mesmo
 * corte da migração 020).
 *
 * O WIRING (chamar estes detectores dentro de /api/teses/avaliar e gravar
 * o resultado em eventos_tese) fica como pendência documentada do Bloco 1 —
 * ver relatório final.
 */

export type EventoTimelineTipo = "mudanca_confluence" | "mudanca_carry" | "mudanca_nota" | "novo_balanco" | "mudanca_tecnica";

export type EventoTimelineDetectado = {
  tipo: EventoTimelineTipo;
  detalhe: Record<string, unknown>;
  explicacao: string;
};

/** Limiares mínimos de variação pra virar evento — evita ruído de arredondamento na timeline. */
export const LIMIARES_TIMELINE = {
  nota: 5, // pontos (escala 0-100)
  confluence: 5, // pontos (escala 0-100)
  carry: 0.01, // 1 ponto percentual de carry real
  tecnica: 10, // pontos (escala 0-100)
} as const;

function formatarPontos(diff: number): string {
  return `${diff >= 0 ? "+" : ""}${diff.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`;
}

export function detectarMudancaNota(
  ticker: string,
  anterior: number | null,
  atual: number | null,
  limiar: number = LIMIARES_TIMELINE.nota
): EventoTimelineDetectado | null {
  if (anterior === null || atual === null) return null;
  const diff = atual - anterior;
  if (Math.abs(diff) < limiar) return null;
  return {
    tipo: "mudanca_nota",
    detalhe: { ticker, anterior, atual, diff },
    explicacao: `Nota (Score Final) mudou de ${anterior} para ${atual} (${formatarPontos(diff)} pontos).`,
  };
}

export function detectarMudancaConfluence(
  ticker: string,
  anterior: number | null,
  atual: number | null,
  limiar: number = LIMIARES_TIMELINE.confluence
): EventoTimelineDetectado | null {
  if (anterior === null || atual === null) return null;
  const diff = atual - anterior;
  if (Math.abs(diff) < limiar) return null;
  return {
    tipo: "mudanca_confluence",
    detalhe: { ticker, anterior, atual, diff },
    explicacao: `Confluence Score mudou de ${anterior} para ${atual} (${formatarPontos(diff)} pontos).`,
  };
}

export function detectarMudancaCarry(
  ticker: string,
  anterior: number | null,
  atual: number | null,
  limiar: number = LIMIARES_TIMELINE.carry
): EventoTimelineDetectado | null {
  if (anterior === null || atual === null) return null;
  const diff = atual - anterior;
  if (Math.abs(diff) < limiar) return null;
  const pctAnterior = `${(anterior * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const pctAtual = `${(atual * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  return {
    tipo: "mudanca_carry",
    detalhe: { ticker, anterior, atual, diff },
    explicacao: `Carry real mudou de IPCA + ${pctAnterior} para IPCA + ${pctAtual} a.a.`,
  };
}

export function detectarMudancaTecnica(
  ticker: string,
  anterior: number | null,
  atual: number | null,
  limiar: number = LIMIARES_TIMELINE.tecnica
): EventoTimelineDetectado | null {
  if (anterior === null || atual === null) return null;
  const diff = atual - anterior;
  if (Math.abs(diff) < limiar) return null;
  return {
    tipo: "mudanca_tecnica",
    detalhe: { ticker, anterior, atual, diff },
    explicacao: `Technical Score mudou de ${anterior} para ${atual} (${formatarPontos(diff)} pontos).`,
  };
}

/**
 * Detecta chegada de balanço novo comparando a competência mais recente
 * conhecida antes/depois de uma coleta. `competenciaAnterior === null`
 * (primeiro balanço já visto pelo sistema para o ticker) também gera
 * evento — é informação legítima da timeline.
 */
export function detectarNovoBalanco(
  ticker: string,
  competenciaAnterior: string | null,
  competenciaAtual: string
): EventoTimelineDetectado | null {
  if (competenciaAnterior === competenciaAtual) return null;
  return {
    tipo: "novo_balanco",
    detalhe: { ticker, competenciaAnterior, competenciaAtual },
    explicacao:
      competenciaAnterior === null
        ? `Primeiro balanço (competência ${competenciaAtual}) registrado para ${ticker}.`
        : `Novo balanço: competência ${competenciaAnterior} → ${competenciaAtual}.`,
  };
}
