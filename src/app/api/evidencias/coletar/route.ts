import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { montarEvidenciaEnriquecida, filtrarEvidenciasNovas, montarLogColeta, type ChaveDedupEvidencia, type EntradaEvidenciaEnriquecida, type EvidenciaEnriquecida } from "@/lib/memory-layer";
import { emitirEvidenciasComunicados, type ComunicadoOficialRow } from "@/lib/memory-layer-comunicados";
import { agruparSerieMacro, emitirEvidenciasMacro, type MacroFocusRow } from "@/lib/memory-layer-macro";
import { emitirEvidenciasResultados, type FundamentoAnualRow } from "@/lib/memory-layer-resultados";
import { emitirEvidenciasCarry, type CarryScoreRow } from "@/lib/memory-layer-carry";

/**
 * MEMORY LAYER — coletor/persistência (Bloco 2, Sprint 2.3).
 *
 * Roda os 4 emissores da Fase A (Comunicados, Macro, Resultados, Carry)
 * sobre dados JÁ coletados pelas fontes reais existentes
 * (comunicados_oficiais, macro_focus, fundamentos, carry_score), deduplica
 * contra o que já está em `evidencias` e grava só o que é novo. Cada
 * execução gera uma linha em `evidencias_coleta_log` (migração 023).
 *
 * NÃO recalcula nada do Foundation — só lê tabelas já povoadas e escreve em
 * `evidencias`, tabela do Evidence Engine (Foundation v3.1, congelado).
 *
 * Pendência registrada (ver ENTREGA da Sprint 2.3): esta rota ainda não
 * está agendada em nenhum cron — chamada manual com o mesmo secret dos
 * outros crons até o Carlos decidir o horário (precisa rodar DEPOIS dos
 * coletores de origem: IPE 07h, backfill CVM 09h, Focus segunda 09h BRT).
 *
 * Disparo: GET com header Authorization: Bearer <CRON_SECRET>.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado" }, { status: 500 });
  }

  const agora = new Date().toISOString();
  const logs: ReturnType<typeof montarLogColeta>[] = [];
  const erros: string[] = [];

  // Evidências já persistidas (chave de dedup) — uma leitura só, reaproveitada pelos 4 emissores desta rodada.
  const { data: existentesRaw, error: erroExistentes } = await supabase
    .from("evidencias")
    .select("ticker, categoria, origem, data, hash");
  if (erroExistentes) {
    return NextResponse.json({ erro: `Falha ao ler evidencias existentes: ${erroExistentes.message}` }, { status: 500 });
  }
  const existentes: ChaveDedupEvidencia[] = (existentesRaw ?? []) as ChaveDedupEvidencia[];

  const todasNovas: EvidenciaEnriquecida[] = [];

  /** Constrói a Evidence completa (com hash) de cada candidata — dedup só é possível depois disso, hash faz parte da chave. */
  function construir(candidatas: EntradaEvidenciaEnriquecida[]): EvidenciaEnriquecida[] {
    return candidatas.map((c) => montarEvidenciaEnriquecida(c, agora));
  }

  // --- Comunicados (IPE) ---
  {
    const inicio = new Date().toISOString();
    const { data, error } = await supabase
      .from("comunicados_oficiais")
      .select("ticker, data_entrega, categoria, assunto, link, protocolo")
      .gte("data_entrega", new Date(Date.now() - 7 * 24 * 3_600_000).toISOString().slice(0, 10));
    if (error) {
      erros.push(`comunicados: ${error.message}`);
    } else {
      const candidatas = emitirEvidenciasComunicados((data ?? []) as ComunicadoOficialRow[]);
      const novas = filtrarEvidenciasNovas(construir(candidatas), [...existentes, ...todasNovas]);
      todasNovas.push(...novas);
      logs.push(montarLogColeta({ coletor: "comunicados_ipe", iniciadoEm: inicio, concluidoEm: new Date().toISOString(), candidatas: candidatas.length, novas: novas.length }));
    }
  }

  // --- Macro (Focus) ---
  {
    const inicio = new Date().toISOString();
    const [{ data: focusData, error: erroFocus }, { data: empresasData, error: erroEmpresas }] = await Promise.all([
      supabase.from("macro_focus").select("indicador, data_pesquisa, ano_referencia, mediana").gte("data_pesquisa", new Date(Date.now() - 21 * 24 * 3_600_000).toISOString().slice(0, 10)),
      supabase.from("empresas").select("ticker"),
    ]);
    if (erroFocus || erroEmpresas) {
      erros.push(`macro: ${erroFocus?.message ?? erroEmpresas?.message}`);
    } else {
      const serie = agruparSerieMacro((focusData ?? []) as MacroFocusRow[]);
      const tickers = (empresasData ?? []).map((e: { ticker: string }) => e.ticker);
      const candidatas = emitirEvidenciasMacro(serie, tickers);
      const novas = filtrarEvidenciasNovas(construir(candidatas), [...existentes, ...todasNovas]);
      todasNovas.push(...novas);
      logs.push(montarLogColeta({ coletor: "macro_focus", iniciadoEm: inicio, concluidoEm: new Date().toISOString(), candidatas: candidatas.length, novas: novas.length }));
    }
  }

  // --- Resultados (fundamentos DFP/ITR) ---
  {
    const inicio = new Date().toISOString();
    const { data, error } = await supabase
      .from("fundamentos")
      .select("ticker, competencia, receita_liquida, lucro_liquido, margem_liquida, roic")
      .order("competencia", { ascending: true });
    if (error) {
      erros.push(`resultados: ${error.message}`);
    } else {
      const porTicker = new Map<string, FundamentoAnualRow[]>();
      for (const row of (data ?? []) as FundamentoAnualRow[]) {
        const lista = porTicker.get(row.ticker) ?? [];
        lista.push(row);
        porTicker.set(row.ticker, lista);
      }
      const candidatas = emitirEvidenciasResultados(porTicker);
      const novas = filtrarEvidenciasNovas(construir(candidatas), [...existentes, ...todasNovas]);
      todasNovas.push(...novas);
      logs.push(montarLogColeta({ coletor: "resultados_dfp_itr", iniciadoEm: inicio, concluidoEm: new Date().toISOString(), candidatas: candidatas.length, novas: novas.length }));
    }
  }

  // --- Carry (carry_score) ---
  {
    const inicio = new Date().toISOString();
    const { data, error } = await supabase
      .from("carry_score")
      .select("ticker, data, carry_real")
      .order("data", { ascending: true });
    if (error) {
      erros.push(`carry: ${error.message}`);
    } else {
      const porTicker = new Map<string, CarryScoreRow[]>();
      for (const row of (data ?? []) as CarryScoreRow[]) {
        const lista = porTicker.get(row.ticker) ?? [];
        lista.push(row);
        porTicker.set(row.ticker, lista);
      }
      const candidatas = emitirEvidenciasCarry(porTicker);
      const novas = filtrarEvidenciasNovas(construir(candidatas), [...existentes, ...todasNovas]);
      todasNovas.push(...novas);
      logs.push(montarLogColeta({ coletor: "carry_score", iniciadoEm: inicio, concluidoEm: new Date().toISOString(), candidatas: candidatas.length, novas: novas.length }));
    }
  }

  // --- Persistência ---
  let inseridas = 0;
  if (todasNovas.length > 0) {
    const linhas = todasNovas.map((c) => {
      return {
        ticker: c.ticker,
        categoria: c.categoria,
        origem: c.origem,
        data: c.data,
        peso_informativo: c.pesoInformativo,
        confiabilidade: c.confiabilidade,
        descricao: c.descricao,
        hash: c.hash,
        status: c.status,
        subcategoria: c.subcategoria,
        titulo: c.titulo,
        url_oficial: c.urlOficial,
        documento_oficial: c.documentoOficial,
      };
    });
    const { error: erroInsert, count } = await supabase.from("evidencias").insert(linhas, { count: "exact" });
    if (erroInsert) {
      erros.push(`insert: ${erroInsert.message}`);
    } else {
      inseridas = count ?? linhas.length;
    }
  }

  if (logs.length > 0) {
    await supabase.from("evidencias_coleta_log").insert(
      logs.map((l) => ({
        coletor: l.coletor,
        iniciado_em: l.iniciadoEm,
        concluido_em: l.concluidoEm,
        quantidade_novas: l.quantidadeNovas,
        quantidade_ignoradas_duplicadas: l.quantidadeIgnoradasDuplicadas,
        quantidade_erros: l.quantidadeErros,
      }))
    );
  }

  return NextResponse.json({ inseridas, candidatas: todasNovas.length, logs, erros });
}
