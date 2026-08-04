import type { SupabaseClient } from "@supabase/supabase-js";
import { montarPerfilTese, type PerfilTese, type StatusTeseReal } from "@/lib/thesis-engine";
import type { Decision } from "@/lib/decision-object";

/**
 * THESIS STATUS DADOS (Bloco 2 — Sprint 2.1, Meu Dash).
 *
 * Adaptador de banco para o Thesis Engine (Foundation v4, Módulo 1) —
 * primeiro call site de produção dele. Duas simplificações honestas,
 * registradas (não escondidas):
 *
 * 1. `strengthDirecao` sempre `null` aqui — o Thesis Strength Engine
 *    (Módulo 4) precisa de DOIS Decision Objects no tempo (`confluenceAnterior`
 *    vs `confluenceAtual`) e o sistema não guarda snapshots de Decision
 *    Object ainda (só a nota oficial em `scores`, motor diferente). Sem
 *    isso, o Status Derivado nunca sai de "confirmada" para
 *    "fortalecendo"/"enfraquecendo" por tendência — só por gatilho
 *    disparado ou tese quebrada. Pendência para quando houver histórico de
 *    Decision Object persistido.
 * 2. `estrutura` sempre `[]` — depende da migração 022 (`tese_estrutura`),
 *    ainda não aplicada no Supabase (Foundation v4, seção 7 do relatório).
 *    `invalidadaManualmente` sempre `false` pela mesma razão (a marcação
 *    manual vive num item de `tese_estrutura`).
 */

type TeseRow = { id: string; ticker: string; versao: number; status: StatusTeseReal; criado_em: string };
type EventoGatilhoRow = { tese_id: string; criado_em: string; gatilhos: { direcao: "positivo" | "negativo" } | null };

export async function montarStatusTeses(
  sb: SupabaseClient,
  tickers: string[],
  decisions: Map<string, Decision>,
  agora: string
): Promise<Map<string, PerfilTese>> {
  if (tickers.length === 0) return new Map();

  const { data: tesesRaw } = await sb
    .from("teses")
    .select("id, ticker, versao, status, criado_em")
    .eq("ativa", true)
    .in("ticker", tickers);
  const teses = (tesesRaw as TeseRow[]) ?? [];
  if (teses.length === 0) return new Map();

  const idsTese = teses.map((t) => t.id);
  const { data: eventosRaw } = await sb
    .from("eventos_tese")
    .select("tese_id, criado_em, gatilhos(direcao)")
    .eq("tipo", "gatilho_disparado")
    .in("tese_id", idsTese)
    .order("criado_em", { ascending: false });
  const eventos = (eventosRaw as unknown as EventoGatilhoRow[]) ?? [];

  const ultimoGatilhoPorTese = new Map<string, "positivo" | "negativo" | null>();
  for (const ev of eventos) {
    if (!ultimoGatilhoPorTese.has(ev.tese_id)) {
      ultimoGatilhoPorTese.set(ev.tese_id, ev.gatilhos?.direcao ?? null);
    }
  }

  const resultado = new Map<string, PerfilTese>();
  for (const tese of teses) {
    const decision = decisions.get(tese.ticker);
    if (!decision) continue; // sem Decision Object, sem perfil de tese (corte honesto — nunca metade calculado)

    const perfil = montarPerfilTese({
      decision,
      teseVersao: tese.versao,
      teseCriadoEm: tese.criado_em,
      agora,
      statusReal: tese.status,
      strengthDirecao: null,
      strengthDelta: null,
      ultimoGatilhoDirecao: ultimoGatilhoPorTese.get(tese.id) ?? null,
      invalidadaManualmente: false,
      estrutura: [],
    });
    resultado.set(tese.ticker, perfil);
  }
  return resultado;
}
