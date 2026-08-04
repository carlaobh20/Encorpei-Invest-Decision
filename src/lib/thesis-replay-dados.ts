import { detectarNovoBalanco, detectarMudancaNota, detectarMudancaCarry } from "./decision-timeline";
import type { DecisaoAvaliada } from "./decision-history";

/**
 * THESIS REPLAY (Bloco 2 — Sprint 2.2, Empresas, Seção 11).
 *
 * "Replay deixa de ser uma tela separada, passa a existir dentro da
 * empresa" — a spec pede uma timeline com 7 tipos de evento (data, novo
 * balanço, mudança da tese, mudança do Carry, mudança do Confluence,
 * mudança do controlador, mudança da recomendação, resultado observado).
 * Inventário honesto do que tem fonte de dado real HOJE, feito antes de
 * codar:
 *  - Novo balanço: real (`fundamentos`, competência nova) — mesmo detector
 *    do Decision Center (`decision-timeline.ts`).
 *  - Mudança da tese: real — `teses` é VERSIONADA por design (regra de
 *    fundação #3, `CLAUDE.md`) e `eventos_tese` já registra criação/revisão/
 *    gatilho/mudança de status, tudo imutável desde o dia 1.
 *  - Mudança do Carry: real — a migração 009 criou `carry_score`, histórico
 *    DIÁRIO e imutável do Carry v1 (mesmo motor de `radar.ts`/cron), gravado
 *    desde 03/08/2026. SUBSTITUIÇÃO HONESTA: é Carry v1 (o daily oficial),
 *    não `Decision.carry` (Foundation v2, escada) — o Decision Object não
 *    tem snapshot histórico persistido. Rotulado "Carry (histórico oficial)"
 *    na UI para não confundir com o Carry v2 mostrado no Hero.
 *  - Mudança do Confluence: SEM fonte — Confluence v2 (Decision Object)
 *    nunca é persistido, só calculado on-the-fly. Não entra na timeline.
 *  - Mudança do controlador: SEM fonte — nenhum coletor (mesmo corte já
 *    documentado em `evidence.ts`). Não entra na timeline.
 *  - Mudança da recomendação: o sistema nunca produz uma "recomendação"
 *    (regra 7, CLAUDE.md — proibido comprar/vender). Fica coberta por
 *    "mudança da tese" (mudança de status), não uma linha própria.
 *  - Resultado observado: real quando há decisões registradas no Diário
 *    pra este ticker (`decision-history.ts`, `avaliarDecisoes`).
 *
 * Função pura — todo dado já vem buscado por quem chama.
 */

export type TipoEventoReplay = "novo_balanco" | "mudanca_nota" | "mudanca_carry" | "evento_tese" | "nova_versao_tese" | "resultado_observado";

export type EventoReplay = {
  tipo: TipoEventoReplay;
  data: string;
  explicacao: string;
};

export type PontoCompetencia = { competencia: string };
export type PontoNota = { data: string; nota: number };
export type PontoCarry = { data: string; carryReal: number | null };
export type EventoTeseRaw = { tipo: string; explicacao: string; criadoEm: string };
export type VersaoTese = { versao: number; status: string; criadoEm: string };

/** Gera 1 evento por transição, iterando TODA a série ascendente — não só o último par. */
function eventosNovoBalanco(ticker: string, competenciasAscendente: PontoCompetencia[]): EventoReplay[] {
  const eventos: EventoReplay[] = [];
  for (let i = 1; i < competenciasAscendente.length; i++) {
    const ev = detectarNovoBalanco(ticker, competenciasAscendente[i - 1].competencia, competenciasAscendente[i].competencia);
    if (ev) eventos.push({ tipo: "novo_balanco", data: competenciasAscendente[i].competencia, explicacao: ev.explicacao });
  }
  return eventos;
}

function eventosMudancaNota(ticker: string, notasAscendente: PontoNota[]): EventoReplay[] {
  const eventos: EventoReplay[] = [];
  for (let i = 1; i < notasAscendente.length; i++) {
    const ev = detectarMudancaNota(ticker, notasAscendente[i - 1].nota, notasAscendente[i].nota);
    if (ev) eventos.push({ tipo: "mudanca_nota", data: notasAscendente[i].data, explicacao: ev.explicacao });
  }
  return eventos;
}

function eventosMudancaCarry(ticker: string, carryAscendente: PontoCarry[]): EventoReplay[] {
  const eventos: EventoReplay[] = [];
  for (let i = 1; i < carryAscendente.length; i++) {
    const ev = detectarMudancaCarry(ticker, carryAscendente[i - 1].carryReal, carryAscendente[i].carryReal);
    if (ev) eventos.push({ tipo: "mudanca_carry", data: carryAscendente[i].data, explicacao: `${ev.explicacao} (Carry v1, histórico oficial diário — pode divergir do Carry v2 mostrado no Hero).` });
  }
  return eventos;
}

/**
 * Monta o Replay completo de uma empresa, ordenado do mais recente para o
 * mais antigo. Reúne só os tipos de evento com fonte real (ver cabeçalho) —
 * nunca fabrica "mudança de Confluence" ou "mudança de controlador".
 */
export function montarThesisReplay(
  ticker: string,
  entrada: {
    competenciasAscendente: PontoCompetencia[];
    notasAscendente: PontoNota[];
    carryAscendente: PontoCarry[];
    eventosTese: EventoTeseRaw[];
    versoesTese: VersaoTese[];
    decisoesAvaliadas: DecisaoAvaliada[];
  }
): EventoReplay[] {
  const eventos: EventoReplay[] = [
    ...eventosNovoBalanco(ticker, entrada.competenciasAscendente),
    ...eventosMudancaNota(ticker, entrada.notasAscendente),
    ...eventosMudancaCarry(ticker, entrada.carryAscendente),
    ...entrada.eventosTese.map((e): EventoReplay => ({ tipo: "evento_tese", data: e.criadoEm, explicacao: `${e.tipo.replace(/_/g, " ")}: ${e.explicacao}` })),
    ...entrada.versoesTese
      .filter((v) => v.versao > 1)
      .map((v): EventoReplay => ({ tipo: "nova_versao_tese", data: v.criadoEm, explicacao: `Tese revisada para a versão ${v.versao} (status: ${v.status}).` })),
    ...entrada.decisoesAvaliadas.map((d): EventoReplay => ({
      tipo: "resultado_observado",
      data: d.criadoEm,
      explicacao: `Decisão "${d.decisao}" registrada no Diário — ${d.explicacaoJulgamento}`,
    })),
  ];

  return eventos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
}
