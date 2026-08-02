import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { calcularScore } from "@/lib/score";
import { lucroLTM, roicMedia4Tri } from "@/lib/fundamentos";

export const dynamic = "force-dynamic";

/**
 * RADAR — onde procurar a PRÓXIMA tese.
 *
 * Avalia as 40 empresas do universo (não só as 11 com tese) com as MESMAS
 * réguas versionadas do algoritmo (v1). A nota aqui é uma PRÉVIA calculada
 * na hora — só vira nota oficial (gravada e imutável) quando a empresa
 * ganha uma tese e entra no motor diário. Dados: balanços CVM, preço brapi,
 * nº de ações oficial da CVM. Nada aqui é recomendação de compra ou venda.
 */

type Fund = {
  ticker: string;
  competencia: string;
  fonte: string;
  lucro_liquido: number | null;
  margem_liquida: number | null;
  roic: number | null;
  divida_liquida: number | null;
  patrimonio_liquido: number | null;
};
type Empresa = { ticker: string; nome: string; setor: string | null };
type Preco = { ticker: string; data: string; fechamento: number; market_cap: number | null };

function corNota(n: number): string {
  if (n >= 80) return "text-emerald-300";
  if (n >= 60) return "text-emerald-500";
  if (n >= 40) return "text-amber-400";
  return "text-red-400";
}
const pct = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default async function Radar() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/radar" titulo="Radar">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const [{ data: empresasRaw }, { data: fundsRaw }, { data: precosRaw }, { data: acoesRaw }, { data: tesesRaw }] =
    await Promise.all([
      supabase.from("empresas").select("ticker, nome, setor").eq("ativo", true),
      supabase
        .from("fundamentos")
        .select("ticker, competencia, fonte, lucro_liquido, margem_liquida, roic, divida_liquida, patrimonio_liquido")
        .order("competencia", { ascending: false }),
      supabase
        .from("precos_diarios")
        .select("ticker, data, fechamento, market_cap")
        .order("data", { ascending: false })
        .limit(300),
      supabase.from("acoes_totais").select("ticker, qtd_acoes"),
      supabase.from("teses").select("ticker").eq("ativa", true),
    ]);

  const empresas = (empresasRaw as Empresa[]) ?? [];
  const fundsPorTicker = new Map<string, Fund[]>();
  for (const f of (fundsRaw as Fund[]) ?? []) {
    const arr = fundsPorTicker.get(f.ticker) ?? [];
    arr.push(f); // já vem ordenado do mais recente p/ o mais antigo
    fundsPorTicker.set(f.ticker, arr);
  }
  const precoPorTicker = new Map<string, Preco>();
  for (const p of (precosRaw as Preco[]) ?? []) {
    if (!precoPorTicker.has(p.ticker)) precoPorTicker.set(p.ticker, p);
  }
  const acoesPorTicker = new Map(
    (((acoesRaw as { ticker: string; qtd_acoes: number }[]) ?? [])).map((a) => [a.ticker, Number(a.qtd_acoes)])
  );
  const comTese = new Set((((tesesRaw as { ticker: string }[]) ?? [])).map((t) => t.ticker));

  const linhas = empresas
    .map((e) => {
      const funds = fundsPorTicker.get(e.ticker) ?? [];
      if (funds.length === 0) return null;
      const rec = funds[0];

      // valor de mercado: nº de ações oficial × fechamento (units "11" e
      // ausências caem no market_cap da brapi — mesmo guardrail do motor)
      const preco = precoPorTicker.get(e.ticker);
      const ehUnit = e.ticker.endsWith("11");
      const qtd = acoesPorTicker.get(e.ticker);
      const mcOficial =
        !ehUnit && qtd && preco?.fechamento ? qtd * Number(preco.fechamento) : null;
      const market_cap =
        mcOficial ?? (preco?.market_cap ? Number(preco.market_cap) : null);

      const ltm = lucroLTM(funds);
      const margensTri = funds
        .filter((f) => f.fonte === "cvm_itr" && f.margem_liquida !== null)
        .slice(0, 6)
        .map((f) => Number(f.margem_liquida));

      const previa = calcularScore({
        roic: rec.roic !== null ? Number(rec.roic) : null,
        margem_liquida: rec.margem_liquida !== null ? Number(rec.margem_liquida) : null,
        divida_liquida: rec.divida_liquida !== null ? Number(rec.divida_liquida) : null,
        patrimonio_liquido:
          rec.patrimonio_liquido !== null ? Number(rec.patrimonio_liquido) : null,
        lucro_ltm: ltm,
        market_cap,
        margens_trimestrais: margensTri,
      });

      const roic4 = roicMedia4Tri(funds);
      const ey = ltm !== null && market_cap && market_cap > 0 ? ltm / market_cap : null;
      const pl = ey !== null && ey > 0 ? 1 / ey : null;
      const alav =
        rec.divida_liquida !== null && rec.patrimonio_liquido !== null && Number(rec.patrimonio_liquido) > 0
          ? Number(rec.divida_liquida) / Number(rec.patrimonio_liquido)
          : null;

      return {
        ...e,
        temTese: comTese.has(e.ticker),
        nota: previa.score_final,
        confianca: previa.confianca,
        componentes: previa.decomposicao.length,
        roic4,
        margem: rec.margem_liquida !== null ? Number(rec.margem_liquida) : null,
        caixaLiquido: rec.divida_liquida !== null && Number(rec.divida_liquida) <= 0,
        alav,
        pl,
        ey,
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null)
    .sort((a, b) => b.nota - a.nota);

  const candidatas = linhas
    .filter((l) => !l.temTese && l.confianca !== "baixa" && l.componentes >= 3)
    .slice(0, 3);

  return (
    <Shell
      ativo="/radar"
      titulo="Radar"
      subtitulo="As 40 empresas do universo avaliadas pelas MESMAS réguas versionadas do algoritmo — prévia calculada na hora, com dados oficiais. É aqui que se procura a próxima tese; nota oficial e imutável, só quando a tese existir."
    >
      {/* ---------- candidatas ---------- */}
      {candidatas.length > 0 && (
        <div className="flex gap-3">
          {candidatas.map((c, i) => (
            <div
              key={c.ticker}
              className="flex-1 rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-sky-300/80">
                candidata a tese nº {i + 1}
              </p>
              <p className="mt-0.5 text-base font-bold">
                <span className="font-mono">{c.ticker}</span>{" "}
                <span className={`${corNota(c.nota)}`}>{c.nota}</span>
                <span className="ml-2 text-xs font-normal text-slate-400">{c.nome}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                ROIC {pct(c.roic4)} · margem {pct(c.margem)} ·{" "}
                {c.caixaLiquido ? "caixa líquido" : `dívida ${pct(c.alav)} do patrimônio`}
                {c.pl !== null && <> · preço/lucro {c.pl.toFixed(1)}×</>}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* ---------- tabela ---------- */}
      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            Universo completo — prévia pelas réguas v1
          </h2>
          <p className="text-[10px] text-slate-600">
            prévia ≠ nota oficial · sem recomendação de compra ou venda
          </p>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-slate-950/90 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                <th className="py-1.5 pr-2">Empresa</th>
                <th className="py-1.5 pr-2">Situação</th>
                <th className="py-1.5 pr-2 text-right">ROIC 4tri</th>
                <th className="py-1.5 pr-2 text-right">Margem</th>
                <th className="py-1.5 pr-2 text-right">Dív/Patr</th>
                <th className="py-1.5 pr-2 text-right">P/L</th>
                <th className="py-1.5 pr-2 text-right">Confiança</th>
                <th className="py-1.5 text-right">Prévia</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="py-1.5 pr-2">
                    {l.temTese ? (
                      <Link href={`/tese/${l.ticker}`} className="hover:underline">
                        <span className="font-mono font-semibold">{l.ticker}</span>
                        <span className="ml-2 text-slate-400">{l.nome}</span>
                      </Link>
                    ) : (
                      <>
                        <span className="font-mono font-semibold">{l.ticker}</span>
                        <span className="ml-2 text-slate-400">{l.nome}</span>
                      </>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    {l.temTese ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        tese ativa
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
                        sem tese
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{pct(l.roic4)}</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{pct(l.margem)}</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                    {l.caixaLiquido ? (
                      <span className="text-emerald-400">caixa</span>
                    ) : (
                      pct(l.alav)
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                    {l.pl !== null ? `${l.pl.toFixed(1)}×` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right text-[11px] text-slate-500">{l.confianca}</td>
                  <td className={`py-1.5 text-right text-sm font-bold ${corNota(l.nota)}`}>
                    {l.componentes > 0 ? l.nota : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-slate-600">
          Como ler: a prévia usa as mesmas réguas da nota oficial (qualidade, valuation e risco,
          pesos v1). Bancos e seguradoras aparecem com confiança menor — ROIC e dívida não se
          aplicam ao modelo deles e o sistema não finge que se aplicam. Empresa boa aqui é
          convite para ESTUDAR e, se convencer, virar tese — nunca ordem de compra.
        </p>
      </section>
    </Shell>
  );
}
