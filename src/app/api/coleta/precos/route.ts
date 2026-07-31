import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

/**
 * Coleta diária de cotações (brapi.dev).
 *
 * Disparo automático: cron da Vercel (ver vercel.json), que envia
 * Authorization: Bearer <CRON_SECRET>.
 * Disparo manual: /api/coleta/precos?secret=<CRON_SECRET>
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
  // --- autenticação do disparo ---
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  const query = req.nextUrl.searchParams.get("secret");
  if (!secret || (header !== `Bearer ${secret}` && query !== secret)) {
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

  const ok: string[] = [];
  const falhas: { ticker: string; motivo: string }[] = [];

  for (const { ticker } of empresas ?? []) {
    try {
      const res = await fetch(
        `${BRAPI_BASE}/${ticker}?token=${brapiToken}`,
        { cache: "no-store" }
      );
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
    falhas,
    executado_em: new Date().toISOString(),
  });
}
