import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { calcularRadar } from "@/lib/radar";
import { calcularTechnicals } from "@/lib/technical-dados";
import { calcularCompounders } from "@/lib/compounder-dados";
import { montarDecisions } from "@/lib/decision-dados";
import { montarStatusTeses } from "@/lib/thesis-status-dados";
import { compararComSetor, mediaSetor } from "@/lib/dash-narrativa";
import { roicMedia4Tri } from "@/lib/fundamentos";
import {
  detectarMudancaTese, detectarMudancaCarryV1, detectarMudancaQualityViaRoic,
  detectarMudancaSnapshotV2, detectarMudancaFluxo, detectarMudancaDividendos,
  type MudancaEvento, type EventoTeseRow,
} from "@/lib/market-scan-change-detection";
import { avaliarOportunidade } from "@/lib/opportunity-engine";
import { montarWatchlists, type EntradaWatchlist } from "@/lib/market-watchlists";
import { montarPainelMarketRadar } from "@/lib/market-radar";
import { MARKET_SCAN_CONFIG } from "@/lib/market-scan-config";

/**
 * MARKET SCAN ENGINE — execução diária (Bloco 2, Sprint 2.10).
 *
 * "Orquestra tudo que já existe, não cria motores" — cada etapa abaixo
 * chama uma função JÁ EXPORTADA de outro lugar (mesmas usadas por Meu Dash/
 * Radar/Decision Center), nunca recalcula nada. Etapas 1-8 da spec
 * (Dados/Truth/Memory/Foundation/Decision Object/Wealth Engine/Rankings/
 * Carteiras) já rodam em outros crons ou nesta própria chamada via reuso;
 * esta rota adiciona só as etapas 9-10 (Detectar mudanças/Gerar
 * oportunidades) que não existiam antes.
 *
 * ESCOPO HONESTO desta rodada (ver docs/market-scan-engine.md): Change
 * Detection cobre as dimensões com dado histórico REAL hoje (tese via
 * eventos_tese, Carry v1 via carry_score, Quality-proxy via tendência de
 * ROIC) — as demais (Growth/Portfolio Fit/Convicção/Técnica) dependem da
 * migração 024 (decision_snapshot_diario), escrita mas NÃO aplicada ainda
 * (mesmo bloqueio de conector Supabase de 022/023); o INSERT no snapshot
 * é tentado e falha graciosamente (não derruba a execução) até lá.
 *
 * Disparo: GET com header Authorization: Bearer <CRON_SECRET>.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const inicio = Date.now();
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado" }, { status: 500 });
  }

  const falhas: string[] = [];
  const geradoEm = new Date().toISOString();
  const hojeSP = geradoEm.slice(0, 10);

  // ---------- Universo (Funil, etapa 1) ----------
  const radarLinhas = await calcularRadar(supabase);
  const universo = radarLinhas.map((r) => r.ticker);

  const [technicalLinhas, compounderLinhas] = await Promise.all([
    calcularTechnicals(supabase),
    calcularCompounders(supabase),
  ]);
  const technicalPorTicker = new Map(technicalLinhas.map((t) => [t.ticker, t]));
  const compounderPorTicker = new Map(compounderLinhas.map((c) => [c.ticker, c]));
  const fundamentosPorTicker = new Map(radarLinhas.map((r) => [r.ticker, { nota: r.nota, componentes: r.componentes }]));

  // ---------- Decision Object (etapa 5) — reaproveita montarDecisions, nunca recalcula ----------
  const decisionsResultado = await montarDecisions(supabase, universo, fundamentosPorTicker, compounderPorTicker, technicalPorTicker, geradoEm);
  const decisions = decisionsResultado.porTicker;

  // ---------- Status derivado das teses (etapa 4/9, tese) ----------
  const statusPorTicker = await montarStatusTeses(supabase, universo, decisions, geradoEm);
  const statusSimplificado = new Map(Array.from(statusPorTicker.entries()).map(([t, p]) => [t, p.thesisStatus]));

  // ---------- Change Detection (etapa 9) ----------
  const desde24h = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data: eventosRaw, error: erroEventos } = await supabase
    .from("eventos_tese")
    .select("teses(ticker), tipo, criado_em, explicacao")
    .gte("criado_em", desde24h);
  if (erroEventos) falhas.push(`eventos_tese: ${erroEventos.message}`);
  const eventosTeseRows: EventoTeseRow[] = ((eventosRaw as unknown as { teses: { ticker: string } | null; tipo: string; criado_em: string; explicacao: string | null }[]) ?? [])
    .filter((e) => e.teses?.ticker)
    .map((e) => ({ ticker: e.teses!.ticker, tipo: e.tipo, criado_em: e.criado_em, descricao: e.explicacao }));

  const ontemSP = new Date(Date.now() - 24 * 3_600_000).toISOString().slice(0, 10);
  const { data: carryOntemRaw, error: erroCarryOntem } = await supabase.from("carry_score").select("ticker, carry_real").eq("data", ontemSP);
  const { data: carryHojeRaw, error: erroCarryHoje } = await supabase.from("carry_score").select("ticker, carry_real").eq("data", hojeSP);
  if (erroCarryOntem) falhas.push(`carry_score (ontem): ${erroCarryOntem.message}`);
  if (erroCarryHoje) falhas.push(`carry_score (hoje): ${erroCarryHoje.message}`);
  const carryOntemPorTicker = new Map(((carryOntemRaw as { ticker: string; carry_real: number | null }[]) ?? []).map((r) => [r.ticker, r.carry_real]));
  const carryHojePorTicker = new Map(((carryHojeRaw as { ticker: string; carry_real: number | null }[]) ?? []).map((r) => [r.ticker, r.carry_real]));

  const { data: fundosPorTickerRaw } = await supabase
    .from("fundamentos")
    .select("ticker, competencia, fonte, roic")
    .order("competencia", { ascending: false });
  const fundosPorTicker = new Map<string, { fonte: string; roic: number | string | null }[]>();
  for (const f of (fundosPorTickerRaw as { ticker: string; fonte: string; roic: number | null }[]) ?? []) {
    const arr = fundosPorTicker.get(f.ticker) ?? [];
    arr.push(f);
    fundosPorTicker.set(f.ticker, arr);
  }

  const todasMudancas: MudancaEvento[] = [];
  const linhasSetorGlobal = radarLinhas.map((r) => ({ ticker: r.ticker, setor: r.setor }));

  for (const ticker of universo) {
    const mudTese = detectarMudancaTese(ticker, eventosTeseRows);
    if (mudTese) todasMudancas.push(mudTese);

    const mudCarry = detectarMudancaCarryV1(ticker, carryOntemPorTicker.get(ticker) ?? null, carryHojePorTicker.get(ticker) ?? null);
    if (mudCarry) todasMudancas.push(mudCarry);

    const funds = fundosPorTicker.get(ticker) ?? [];
    const roicHoje = roicMedia4Tri(funds);
    const roicAnterior = roicMedia4Tri(funds.slice(1));
    const mudQuality = detectarMudancaQualityViaRoic(ticker, roicAnterior, roicHoje);
    if (mudQuality) todasMudancas.push(mudQuality);

    // Growth/Portfolio Fit/Convicção/Técnica — sem captura anterior ainda (migração 024 não aplicada); registrado, não fabricado.
    for (const campo of ["growth", "portfolio_fit", "conviccao", "tecnica"] as const) {
      todasMudancas.push(detectarMudancaSnapshotV2(ticker, campo, null, null));
    }
    todasMudancas.push(detectarMudancaFluxo(ticker));
    todasMudancas.push(detectarMudancaDividendos(ticker));
  }

  // ---------- Opportunity Engine (etapa 10) ----------
  const oportunidades = universo.map((ticker) => {
    const d = decisions.get(ticker);
    const mudancasDoTicker = todasMudancas.filter((m) => m.ticker === ticker);
    return avaliarOportunidade({
      ticker,
      confluence: d?.confluence ?? null,
      carry: d?.carry ?? null,
      riscoTexto: d?.risk.motivo ?? null,
      fdieCritico: (d?.fdie.critico ?? 0) > 0,
      mudancasRecentes: mudancasDoTicker,
    });
  }).filter((o): o is NonNullable<typeof o> => o !== null);

  // ---------- Watchlists ----------
  const entradasWatchlist: EntradaWatchlist[] = universo.map((ticker) => {
    const d = decisions.get(ticker);
    const r = radarLinhas.find((x) => x.ticker === ticker);
    const comp = compounderPorTicker.get(ticker);
    const funds = fundosPorTicker.get(ticker) ?? [];
    const roicHoje = roicMedia4Tri(funds);
    const roicAnterior = roicMedia4Tri(funds.slice(1));
    const variacaoRelativa = roicAnterior !== null && roicHoje !== null && roicAnterior !== 0 ? (roicHoje - roicAnterior) / Math.abs(roicAnterior) : null;
    const mediaConfluenceSetor = d ? mediaSetor(ticker, d.setor, linhasSetorGlobal.map((l) => ({ ticker: l.ticker, setor: l.setor })), (l) => decisions.get(l.ticker)?.confluence ?? null) : null;
    return {
      ticker,
      confluence: d?.confluence ?? null,
      carry: d?.carry ?? null,
      quality: d?.quality ?? null,
      growth: d?.growth ?? null,
      compounderScore: comp?.resultado.score ?? null,
      marketCap: r?.carryMarketCap ?? null,
      thesisStatus: statusSimplificado.get(ticker) ?? null,
      roicVariacaoRelativa: variacaoRelativa,
      comparacaoConfluenceSetor: d ? compararComSetor(d.confluence, mediaConfluenceSetor) : "indisponivel",
    };
  });
  const watchlists = montarWatchlists(entradasWatchlist);

  // ---------- Market Radar (painel) ----------
  const painel = montarPainelMarketRadar({ universo, mudancas: todasMudancas, oportunidades, statusPorTicker: statusSimplificado, geradoEm });

  // ---------- Snapshot diário (migração 024) — tentado, falha graciosamente se a tabela não existir ----------
  let snapshotsGravados = 0;
  const linhasSnapshot = universo.map((ticker) => {
    const d = decisions.get(ticker);
    return {
      ticker, data: hojeSP,
      confluence: d?.confluence ?? null, carry: d?.carry ?? null, quality: d?.quality ?? null,
      growth: d?.growth ?? null, technical: d?.technical ?? null, portfolio_fit: d?.portfolioFit ?? null,
      conviccao: d?.conviccao ?? null,
    };
  });
  if (linhasSnapshot.length > 0) {
    const { error: erroSnapshot, count } = await supabase
      .from("decision_snapshot_diario")
      .upsert(linhasSnapshot, { onConflict: "ticker,data", count: "exact" });
    if (erroSnapshot) {
      falhas.push(`decision_snapshot_diario indisponível (migração 024 provavelmente não aplicada ainda): ${erroSnapshot.message}`);
    } else {
      snapshotsGravados = count ?? linhasSnapshot.length;
    }
  }

  const tempoMs = Date.now() - inicio;
  const resumo = {
    tempoMs,
    empresasProcessadas: universo.length,
    mudancasDetectadas: todasMudancas.filter((m) => m.disponivel).length,
    mudancasIndisponiveis: todasMudancas.filter((m) => !m.disponivel).length,
    oportunidadesGeradas: oportunidades.length,
    snapshotsGravados,
    falhas,
    painel,
    watchlists: Object.fromEntries(Object.entries(watchlists).map(([k, v]) => [k, v.length])),
    configuracaoUsada: MARKET_SCAN_CONFIG,
  };
  console.log("[market-scan] execução concluída:", JSON.stringify({ ...resumo, painel: undefined, configuracaoUsada: undefined }));

  return NextResponse.json(resumo);
}
