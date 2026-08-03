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

  // ---------- SINCRONIZAÇÃO DIÁRIA DE FUNDAMENTOS (CVM via Actions) ----------
  // O robô do GitHub baixa a CVM todo dia útil de manhã e commita um JSON;
  // aqui ele entra no banco sozinho — resultado novo (ex.: 2T26) aparece no
  // app no MESMO dia, sem passo manual. Guardado: falha aqui não derruba a
  // coleta de preços.
  let fundamentos_sync = "pulado";
  try {
    const RAW =
      "https://raw.githubusercontent.com/carlaobh20/Encorpei-Invest-Decision/main/tools/dados/fundamentos.json";
    const rSync = await fetch(RAW, { cache: "no-store" });
    if (rSync.ok) {
      const j = (await rSync.json()) as {
        gerado_em: string;
        fundamentos: Record<string, unknown>[];
        acoes_totais: { ticker: string; qtd_acoes: number; data_referencia: string }[];
      };
      let nFund = 0;
      const lote = 200;
      for (let i = 0; i < (j.fundamentos ?? []).length; i += lote) {
        const { error } = await supabase
          .from("fundamentos")
          .upsert(j.fundamentos.slice(i, i + lote), {
            onConflict: "ticker,competencia,fonte",
          });
        if (!error) nFund += Math.min(lote, j.fundamentos.length - i);
      }
      let nAcoes = 0;
      if ((j.acoes_totais ?? []).length > 0) {
        const { error } = await supabase
          .from("acoes_totais")
          .upsert(
            j.acoes_totais.map((a) => ({ ...a, fonte: "cvm_composicao_capital" })),
            { onConflict: "ticker" }
          );
        if (!error) nAcoes = j.acoes_totais.length;
      }
      fundamentos_sync = `${nFund} períodos + ${nAcoes} ações (gerado ${j.gerado_em})`;

      // comunicações oficiais (IPE) — guardado: se a tabela 010 ainda não
      // existir, o upsert falha em silêncio e tenta de novo amanhã
      try {
        const rCom = await fetch(
          "https://raw.githubusercontent.com/carlaobh20/Encorpei-Invest-Decision/main/tools/dados/comunicados.json",
          { cache: "no-store" }
        );
        if (rCom.ok) {
          const jc = (await rCom.json()) as { comunicados: Record<string, unknown>[] };
          let nCom = 0;
          for (let i = 0; i < (jc.comunicados ?? []).length; i += 500) {
            const { error } = await supabase
              .from("comunicados_oficiais")
              .upsert(jc.comunicados.slice(i, i + 500), {
                onConflict: "ticker,protocolo",
                ignoreDuplicates: true,
              });
            if (error) break;
            nCom += Math.min(500, jc.comunicados.length - i);
          }
          fundamentos_sync += ` · ${nCom} comunicações`;
        }
      } catch {
        /* tabela 010 pendente — segue o jogo */
      }

      // fluxo de caixa (DFC/CVM) — alimenta os níveis 2-4 do Carry Engine.
      // Guardado: qualquer falha aqui não derruba a coleta de preços.
      try {
        const rFlx = await fetch(
          "https://raw.githubusercontent.com/carlaobh20/Encorpei-Invest-Decision/main/tools/dados/fluxo_caixa.json",
          { cache: "no-store" }
        );
        if (rFlx.ok) {
          const jf = (await rFlx.json()) as { fluxo: Record<string, unknown>[] };
          let nFlx = 0;
          for (let i = 0; i < (jf.fluxo ?? []).length; i += 200) {
            const { error } = await supabase
              .from("fluxo_caixa")
              .upsert(jf.fluxo.slice(i, i + 200), {
                onConflict: "ticker,competencia,fonte,inicio",
              });
            if (error) break;
            nFlx += Math.min(200, jf.fluxo.length - i);
          }
          fundamentos_sync += ` · ${nFlx} fluxos de caixa`;
        }
      } catch {
        /* tabela 011 pendente — segue o jogo */
      }

      // Relatório Focus (BCB) — expectativas macro oficiais.
      try {
        const rFoc = await fetch(
          "https://raw.githubusercontent.com/carlaobh20/Encorpei-Invest-Decision/main/tools/dados/macro_focus.json",
          { cache: "no-store" }
        );
        if (rFoc.ok) {
          const jm = (await rFoc.json()) as { focus: Record<string, unknown>[] };
          let nFoc = 0;
          for (let i = 0; i < (jm.focus ?? []).length; i += 500) {
            const { error } = await supabase
              .from("macro_focus")
              .upsert(jm.focus.slice(i, i + 500), {
                onConflict: "indicador,data_pesquisa,ano_referencia",
                ignoreDuplicates: true,
              });
            if (error) break;
            nFoc += Math.min(500, jm.focus.length - i);
          }
          fundamentos_sync += ` · ${nFoc} obs. Focus`;
        }
      } catch {
        /* tabela 012 pendente — segue o jogo */
      }

      // Benchmarks oficiais (CDI/IPCA via BCB/SGS) — destrava a comparação
      // da Carteira com referências reais.
      try {
        const rBmk = await fetch(
          "https://raw.githubusercontent.com/carlaobh20/Encorpei-Invest-Decision/main/tools/dados/benchmarks_macro.json",
          { cache: "no-store" }
        );
        if (rBmk.ok) {
          const jb = (await rBmk.json()) as { benchmarks: Record<string, unknown>[] };
          let nBmk = 0;
          for (let i = 0; i < (jb.benchmarks ?? []).length; i += 500) {
            const { error } = await supabase
              .from("benchmarks_diarios")
              .upsert(jb.benchmarks.slice(i, i + 500), {
                onConflict: "indicador,data",
                ignoreDuplicates: true,
              });
            if (error) break;
            nBmk += Math.min(500, jb.benchmarks.length - i);
          }
          fundamentos_sync += ` · ${nBmk} obs. CDI/IPCA`;
        }
      } catch {
        /* tabela 015 pendente — segue o jogo */
      }
    } else {
      fundamentos_sync = `JSON indisponível (HTTP ${rSync.status})`;
    }
  } catch (e) {
    fundamentos_sync = `falhou: ${String(e).slice(0, 120)}`;
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

  // ---------- Ibovespa (benchmark) — mesma brapi, guardado se indisponível ----------
  // Sem série pública gratuita de índice no BCB; a brapi já é a fonte oficial
  // de preços deste sistema. Falha aqui NUNCA derruba a coleta de ações.
  let ibovespa_sync = "pulado";
  try {
    const resIbov = await fetch(`${BRAPI_BASE}/%5EBVSP?token=${brapiToken}`, { cache: "no-store" });
    if (resIbov.ok) {
      const jIbov = await resIbov.json();
      const qIbov = jIbov?.results?.[0];
      if (qIbov?.regularMarketPrice) {
        const { error: errIbov } = await supabase.from("benchmarks_diarios").upsert(
          {
            indicador: "IBOVESPA",
            data: dataPregaoSaoPaulo(qIbov.regularMarketTime),
            valor: qIbov.regularMarketPrice,
            fonte: "brapi",
          },
          { onConflict: "indicador,data" }
        );
        ibovespa_sync = errIbov ? `falhou ao gravar: ${errIbov.message}` : "ok";
      } else {
        ibovespa_sync = "sem preço na resposta (^BVSP pode não existir neste plano)";
      }
    } else {
      ibovespa_sync = `HTTP ${resIbov.status} (^BVSP pode não existir neste plano)`;
    }
  } catch (e) {
    ibovespa_sync = `falhou: ${String(e).slice(0, 120)}`;
  }

  return NextResponse.json({
    coletados: ok.length,
    historico_gravado,
    fundamentos_sync,
    ibovespa_sync,
    falhas,
    executado_em: new Date().toISOString(),
  });
}
