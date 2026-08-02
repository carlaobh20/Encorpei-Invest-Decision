import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Coleta diária de cotações (brapi.dev).
 *
 * Disparo automático: cron da Vercel (ver vercel.json), que envia
 * Authorization: Bearer <CRON_SECRET>. Disparo manual: mesmo header.
 *
 * AUTO-BACKFILL (02/08/2026): enquanto um ticker tiver menos de 40 pregões
 * gravados, a coleta pede também o histórico de 3 meses (range=3mo) e grava
 * o que a brapi devolver, com fonte própria. Se o plano não permitir
 * histórico, cai no fluxo normal sem quebrar — e o acervo cresce dia a dia.
 *
 * Fundação: a resposta original da brapi é gravada em `dados_brutos`
 * ANTES do tratamento (regra 4 — dados brutos preservados). O preço
 * tratado vai para `precos_diarios` com fonte e data de coleta.
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const BRAPI_BASE = "https://brapi.dev/api/quote";

function dataPregaoSaoPaulo(regularMarketTime?: string): string {
  const d = regularMarketTime ? new Date(regularMarketTime) : new Date();
  // data no fuso de São Paulo (UTC-3, sem horário de verão desde 2019)
  const spMs = d.getTime() - 3 * 60 * 60 * 1000;
  return new Date(spMs).toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  // --- autenticação do disparo (SÓ header; secret em URL vaza em logs
  // e histórico do navegador — removido na revisão de segurança 01/08) ---
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { erro: "Supabase não configurado (variáveis de ambiente ausentes)" },
      { status: 500 }
    );
  }
  const brapiToken = process.env.BRAPI_TOKEN;
  if (!brapiToken) {
    return NextResponse.json(
      { erro: "BRAPI_TOKEN ausente nas variáveis de ambiente" },
      { status: 500 }
    );
  }

  // --- universo ativo ---
  const { data: empresas, error: errEmpresas } = await supabase
    .from("empresas")
    .select("ticker")
    .eq("ativo", true);
  if (errEmpresas) {
    return NextResponse.json({ erro: errEmpresas.message }, { status: 500 });
  }

  // quantos pregões já temos por ticker (últimos ~130 dias)
  const desde130 = new Date(Date.now() - 130 * 86_400_000).toISOString().slice(0, 10);
  const { data: existentes } = await supabase
    .from("precos_diarios")
    .select("ticker, data")
    .gte("data", desde130);
  const pregoesPorTicker = new Map<string, number>();
  for (const p of existentes ?? []) {
    pregoesPorTicker.set(p.ticker, (pregoesPorTicker.get(p.ticker) ?? 0) + 1);
  }

  const ok: string[] = [];
  const falhas: { ticker: string; motivo: string }[] = [];
  let historico_gravado = 0;

  for (const { ticker } of empresas ?? []) {
    try {
      const precisaHistorico = (pregoesPorTicker.get(ticker) ?? 0) < 40;
      let res = await fetch(
        `${BRAPI_BASE}/${ticker}?token=${brapiToken}${precisaHistorico ? "&range=3mo&interval=1d" : ""}`,
        { cache: "no-store" }
      );
      // plano sem histórico? tenta de novo sem o range, sem perder o dia
      if (!res.ok && precisaHistorico) {
        res = await fetch(`${BRAPI_BASE}/${ticker}?token=${brapiToken}`, { cache: "no-store" });
      }
      if (!res.ok) {
        falhas.push({ ticker, motivo: `HTTP ${res.status}` });
        continue;
      }
      const json = await res.json();
      const q = json?.results?.[0];
      if (!q?.regularMarketPrice) {
        falhas.push({ ticker, motivo: "sem preço na resposta" });
        continue;
      }

      // histórico retroativo (se o plano devolveu)
      const hist = Array.isArray(q.historicalDataPrice) ? q.historicalDataPrice : [];
      if (hist.length > 0) {
        const linhas = hist
          .filter((h: { date?: number; close?: number }) => h?.date && h?.close)
          .map((h: { date: number; close: number; volume?: number }) => ({
            ticker,
            data: dataPregaoSaoPaulo(new Date(h.date * 1000).toISOString()),
            fechamento: h.close,
            volume: h.volume ?? null,
            fonte: "brapi_historico",
          }));
        if (linhas.length > 0) {
          const { error: errHist } = await supabase
            .from("precos_diarios")
            .upsert(linhas, { onConflict: "ticker,data", ignoreDuplicates: true });
          if (!errHist) historico_gravado += linhas.length;
        }
      }

      // (4) dado bruto preservado antes do tratamento
      await supabase.from("dados_brutos").insert({
        fonte: "brapi",
        referencia: ticker,
        payload: json,
      });

      // dado tratado, com proveniência
      const { error: errUpsert } = await supabase
        .from("precos_diarios")
        .upsert(
          {
            ticker,
            data: dataPregaoSaoPaulo(q.regularMarketTime),
            fechamento: q.regularMarketPrice,
            volume: q.regularMarketVolume ?? null,
            market_cap: q.marketCap ?? null,
            fonte: "brapi",
          },
          { onConflict: "ticker,data" }
        );
      if (errUpsert) {
        falhas.push({ ticker, motivo: errUpsert.message });
        continue;
      }
      ok.push(ticker);
      // gentileza com o plano gratuito da brapi
      await new Promise((r) => setTimeout(r, 250));
    } catch (e) {
      falhas.push({ ticker, motivo: String(e) });
    }
  }

  return NextResponse.json({
    coletados: ok.length,
    historico_gravado,
    falhas,
    executado_em: new Date().toISOString(),
  });
}
