import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularSeriePatrimonio, type PosicaoDatada, type ResultadoPatrimonio } from "./patrimonio";

/**
 * Monta a entrada do motor de Patrimônio e roda o cálculo — mesmo padrão
 * de radar.ts/compounder-dados.ts/technical-dados.ts: fetch e assemble
 * aqui, cálculo puro e testável em src/lib/patrimonio.ts.
 */

export type PatrimonioDados = {
  resultado: ResultadoPatrimonio;
  /** posições registradas SEM data de compra — não entraram na série (nunca estimada) */
  posicoesForaDaSerie: string[];
};

type PosicaoRaw = { ticker: string; quantidade: number; preco_medio: number; data_compra: string | null };

/** Mesma proteção contra o corte silencioso do PostgREST (~1000 linhas) usada em technical-dados.ts. */
async function buscarPrecosPaginado(
  sb: SupabaseClient,
  tickers: string[],
  desde: string
): Promise<{ ticker: string; data: string; fechamento: number }[]> {
  const PAGINA = 1000;
  const linhas: { ticker: string; data: string; fechamento: number }[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await sb
      .from("precos_diarios")
      .select("ticker, data, fechamento")
      .in("ticker", tickers)
      .gte("data", desde)
      .order("data", { ascending: true })
      .range(inicio, inicio + PAGINA - 1);
    if (error || !data || data.length === 0) break;
    linhas.push(...(data as { ticker: string; data: string; fechamento: number }[]));
    if (data.length < PAGINA) break;
  }
  return linhas;
}

export async function calcularPatrimonio(sb: SupabaseClient): Promise<PatrimonioDados | null> {
  const { data: posicoesRaw, error } = await sb
    .from("posicoes")
    .select("ticker, quantidade, preco_medio, data_compra");
  if (error) return null;
  const posicoes = (posicoesRaw as PosicaoRaw[]) ?? [];
  if (posicoes.length === 0) return null;

  const datadas: PosicaoDatada[] = [];
  const posicoesForaDaSerie: string[] = [];
  for (const p of posicoes) {
    if (p.data_compra) {
      datadas.push({
        ticker: p.ticker,
        quantidade: Number(p.quantidade),
        precoMedio: Number(p.preco_medio),
        dataCompra: p.data_compra,
      });
    } else {
      posicoesForaDaSerie.push(p.ticker);
    }
  }

  if (datadas.length === 0) {
    return {
      resultado: calcularSeriePatrimonio({
        posicoes: [],
        precosPorTicker: new Map(),
        cdi: [],
        ipca: [],
        ibovespa: [],
        datasPregao: [],
      }),
      posicoesForaDaSerie,
    };
  }

  const tickers = [...new Set(datadas.map((p) => p.ticker))];
  const dataMin = datadas.reduce((m, p) => (p.dataCompra < m ? p.dataCompra : m), datadas[0].dataCompra);

  const [precosRaw, { data: cdiRaw }, { data: ipcaRaw }, { data: ibovRaw }] = await Promise.all([
    buscarPrecosPaginado(sb, tickers, dataMin),
    sb.from("benchmarks_diarios").select("data, valor").eq("indicador", "CDI").gte("data", dataMin).order("data", { ascending: true }),
    sb.from("benchmarks_diarios").select("data, valor").eq("indicador", "IPCA").gte("data", dataMin).order("data", { ascending: true }),
    sb.from("benchmarks_diarios").select("data, valor").eq("indicador", "IBOVESPA").gte("data", dataMin).order("data", { ascending: true }),
  ]);

  const precosPorTicker = new Map<string, { data: string; fechamento: number }[]>();
  const datasSet = new Set<string>();
  for (const p of precosRaw) {
    const arr = precosPorTicker.get(p.ticker) ?? [];
    arr.push({ data: p.data, fechamento: Number(p.fechamento) });
    precosPorTicker.set(p.ticker, arr);
    datasSet.add(p.data);
  }
  const datasPregao = [...datasSet].sort();

  const resultado = calcularSeriePatrimonio({
    posicoes: datadas,
    precosPorTicker,
    cdi: (((cdiRaw as { data: string; valor: number }[]) ?? [])).map((o) => ({ data: o.data, valor: Number(o.valor) })),
    ipca: (((ipcaRaw as { data: string; valor: number }[]) ?? [])).map((o) => ({ data: o.data, valor: Number(o.valor) })),
    ibovespa: (((ibovRaw as { data: string; valor: number }[]) ?? [])).map((o) => ({ data: o.data, valor: Number(o.valor) })),
    datasPregao,
  });

  return { resultado, posicoesForaDaSerie };
}
