import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import {
  GraficoBarras,
  rotuloTrimestre,
  CORES_COMPARADOR,
  type SerieBarras,
} from "@/components/GraficoBarras";

export const dynamic = "force-dynamic";

type Fund = {
  ticker: string;
  competencia: string;
  fonte: string;
  receita_liquida: number | null;
  margem_liquida: number | null;
  roic: number | null;
  divida_liquida: number | null;
};

export default async function Comparar({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; c?: string }>;
}) {
  const sp = await searchParams;
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/comparar" titulo="Comparador">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const { data: tesesRaw } = await supabase
    .from("teses").select("ticker").eq("ativa", true).order("ticker");
  const tickers = ((tesesRaw as { ticker: string }[]) ?? []).map((t) => t.ticker);

  const escolhidos = [sp.a, sp.b, sp.c]
    .map((t) => (t ?? "").toUpperCase())
    .filter((t) => tickers.includes(t));
  const unicos = [...new Set(escolhidos)].slice(0, 3);
  const padrao = unicos.length >= 2 ? unicos : ["WEGE3", "INTB3"].filter((t) => tickers.includes(t));

  let series: Record<string, SerieBarras[]> = {};
  let resumo: { ticker: string; cor: string; score: number | null; margem: number | null; roic: number | null; caixaLiquido: boolean | null }[] = [];

  if (padrao.length >= 2) {
    const [{ data: fundsRaw }, { data: scoresRaw }] = await Promise.all([
      supabase
        .from("fundamentos")
        .select("ticker, competencia, fonte, receita_liquida, margem_liquida, roic, divida_liquida")
        .in("ticker", padrao)
        .eq("fonte", "cvm_itr")
        .order("competencia", { ascending: true }),
      supabase
        .from("scores")
        .select("ticker, data, score_final")
        .in("ticker", padrao)
        .order("data", { ascending: false })
        .limit(30),
    ]);
    const funds = (fundsRaw as Fund[]) ?? [];
    const competencias = [...new Set(funds.map((f) => f.competencia))].sort().slice(-6);

    const serie = (campo: keyof Fund): SerieBarras[] =>
      padrao.map((t, i) => ({
        nome: t,
        cor: CORES_COMPARADOR[i],
        pontos: competencias.map((c) => {
          const f = funds.find((x) => x.ticker === t && x.competencia === c);
          const v = f?.[campo];
          return { rotulo: rotuloTrimestre(c), valor: v != null ? Number(v) : null };
        }),
      }));

    series = {
      receita: serie("receita_liquida"),
      margem: serie("margem_liquida"),
      roic: serie("roic"),
    };

    resumo = padrao.map((t, i) => {
      const ult = [...funds].reverse().find((f) => f.ticker === t);
      const sc = ((scoresRaw as { ticker: string; score_final: number }[]) ?? []).find((s) => s.ticker === t);
      return {
        ticker: t,
        cor: CORES_COMPARADOR[i],
        score: sc?.score_final ?? null,
        margem: ult?.margem_liquida != null ? Number(ult.margem_liquida) : null,
        roic: ult?.roic != null ? Number(ult.roic) : null,
        caixaLiquido: ult?.divida_liquida != null ? Number(ult.divida_liquida) <= 0 : null,
      };
    });
  }

  const pct = (v: number | null) =>
    v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

  return (
    <Shell
      ativo="/comparar"
      titulo="Comparador"
      subtitulo="Até 3 empresas lado a lado, trimestre a trimestre — mesmos dados oficiais, mesma régua. A cor acompanha a empresa em todos os gráficos."
    >
      {/* seleção */}
      <form method="GET" className="flex flex-wrap items-center gap-2 text-sm">
        {(["a", "b", "c"] as const).map((slot, i) => (
          <select
            key={slot}
            name={slot}
            defaultValue={padrao[i] ?? ""}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 focus:border-emerald-500/50 focus:outline-none"
          >
            <option value="">{i === 2 ? "3ª (opcional)…" : `${i + 1}ª empresa…`}</option>
            {tickers.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        ))}
        <button
          type="submit"
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500"
        >
          Comparar
        </button>
        {/* legenda: cor segue a empresa */}
        <div className="ml-auto flex gap-4 text-[11px] text-slate-400">
          {resumo.map((r) => (
            <span key={r.ticker} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.cor }} />
              {r.ticker}
            </span>
          ))}
        </div>
      </form>

      {padrao.length < 2 ? (
        <p className="text-slate-500">Escolha ao menos 2 empresas para comparar.</p>
      ) : (
        <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto pr-1">
          {/* resumo */}
          <div className={`grid gap-3 ${resumo.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {resumo.map((r) => (
              <div key={r.ticker} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-lg font-bold">
                    <span className="h-3 w-3 rounded-sm" style={{ background: r.cor }} />
                    {r.ticker}
                  </span>
                  <span className="text-2xl font-bold text-emerald-300">{r.score ?? "—"}</span>
                </div>
                <p className="mt-2 text-[12px] text-slate-400">
                  Margem {pct(r.margem)} · ROIC {pct(r.roic)} ·{" "}
                  {r.caixaLiquido === null ? "balanço n/d" : r.caixaLiquido ? "caixa líquido" : "com dívida"}
                </p>
              </div>
            ))}
          </div>

          {/* gráficos — um eixo por gráfico, nunca eixo duplo */}
          <div className="grid gap-3 lg:grid-cols-3">
            <GraficoBarras titulo="Receita por trimestre" formato="reais" altura={110} series={series.receita ?? []} />
            <GraficoBarras titulo="Margem líquida" formato="percentual" altura={110} series={series.margem ?? []} />
            <GraficoBarras titulo="ROIC (pós-imposto)" formato="percentual" altura={110} series={series.roic ?? []} />
          </div>
          <p className="text-[10px] text-slate-600">
            Fonte: demonstrativos oficiais (CVM), trimestres isolados. Passe o
            mouse nas barras para ver os valores exatos.
          </p>
        </div>
      )}
    </Shell>
  );
}
