import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularTechnical } from "@/lib/technical/v1";
import type { TechnicalResultado } from "@/lib/technical/types";
import { modeloDe, type ModeloAnalise } from "@/lib/setores";

/**
 * Monta a entrada do Technical Engine e roda o cálculo, empresa por
 * empresa — mesmo padrão de radar.ts e compounder-dados.ts: fetch e
 * assemble aqui, cálculo puro e testável em src/lib/technical/v1.ts.
 *
 * Só entra no ranking quem tem preços com máxima/mínima reais (migração
 * 018) — sem isso não dá ATR nem estrutura de mercado confiável, e o
 * corte honesto é não fingir dado que não existe.
 */

export type LinhaTechnical = {
  ticker: string;
  nome: string;
  modelo: ModeloAnalise | null;
  resultado: TechnicalResultado;
  precoAtual: number | null;
};

type Preco = {
  ticker: string;
  data: string;
  abertura: number | null;
  maxima: number | null;
  minima: number | null;
  fechamento: number;
  volume: number | null;
};

export async function calcularTechnicals(sb: SupabaseClient): Promise<LinhaTechnical[]> {
  const [{ data: empresasRaw }, { data: precosRaw }, { data: tesesRaw }] = await Promise.all([
    sb.from("empresas").select("ticker, nome").eq("ativo", true),
    sb
      .from("precos_diarios")
      .select("ticker, data, abertura, maxima, minima, fechamento, volume")
      .order("data", { ascending: true })
      .limit(20000),
    sb.from("teses").select("ticker").eq("ativa", true),
  ]);

  const empresas = (empresasRaw as { ticker: string; nome: string }[]) ?? [];
  const comTese = new Set((((tesesRaw as { ticker: string }[]) ?? [])).map((t) => t.ticker));

  const precosPorTicker = new Map<string, Preco[]>();
  for (const p of (precosRaw as Preco[]) ?? []) {
    const arr = precosPorTicker.get(p.ticker) ?? [];
    arr.push(p); // já vem ordenado por data ascendente (mais antigo → mais recente)
    precosPorTicker.set(p.ticker, arr);
  }

  const linhas: LinhaTechnical[] = [];

  for (const e of empresas) {
    const precos = (precosPorTicker.get(e.ticker) ?? []).filter(
      (p) => p.maxima !== null && p.minima !== null
    );
    if (precos.length < 3) continue; // sem OHLC real suficiente — nem tenta

    const closes = precos.map((p) => Number(p.fechamento));
    const maximas = precos.map((p) => Number(p.maxima));
    const minimas = precos.map((p) => Number(p.minima));
    const volumes = precos.map((p) => (p.volume !== null ? Number(p.volume) : 0));

    const resultado = calcularTechnical({
      ticker: e.ticker,
      closes,
      maximas,
      minimas,
      volumes,
      temTese: comTese.has(e.ticker),
    });

    linhas.push({
      ticker: e.ticker,
      nome: e.nome,
      modelo: modeloDe(e.ticker),
      resultado,
      precoAtual: closes.length > 0 ? closes[closes.length - 1] : null,
    });
  }

  return linhas.sort((a, b) => (b.resultado.score ?? -1) - (a.resultado.score ?? -1));
}
