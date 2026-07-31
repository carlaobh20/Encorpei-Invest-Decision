import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Score = {
  ticker: string;
  data: string;
  qualidade: number | null;
  valuation: number | null;
  risco: number | null;
  score_final: number;
  confianca: string;
  empresas: { nome: string } | null;
};

function corNota(n: number | null): string {
  if (n === null) return "text-slate-600";
  if (n >= 80) return "text-emerald-400";
  if (n >= 60) return "text-emerald-600";
  if (n >= 40) return "text-amber-400";
  return "text-red-400";
}

export default async function Ranking() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-10">
        Supabase não configurado.
      </main>
    );
  }

  // score mais recente de cada ticker
  const { data } = await supabase
    .from("scores")
    .select("ticker, data, qualidade, valuation, risco, score_final, confianca, empresas(nome)")
    .order("data", { ascending: false })
    .limit(200);
  const vistos = new Set<string>();
  const scores: Score[] = [];
  for (const s of (data as unknown as Score[]) ?? []) {
    if (!vistos.has(s.ticker)) {
      vistos.add(s.ticker);
      scores.push(s);
    }
  }
  scores.sort((a, b) => b.score_final - a.score_final);
  const dataRef = scores[0]?.data
    ? scores[0].data.split("-").reverse().join("/")
    : null;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">
          Fase 3 · Decision Engine
        </p>
        <h1 className="mt-2 text-3xl font-bold">Ranking do universo</h1>
        <p className="mt-2 text-sm text-slate-400">
          Nota de 0 a 100 calculada por regras fixas e versionadas — nunca por
          opinião, nunca por IA. Clique na empresa para ver a tese e cada
          régua que compôs a nota.
        </p>
        <p className="mt-3 rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-xs leading-relaxed text-slate-400">
          <span className="text-slate-300">Qualidade</span> = o negócio é bom?
          (retorno, margem, balanço) ·{" "}
          <span className="text-slate-300">Valuation</span> = o preço está
          razoável? (lucro ÷ valor de mercado) ·{" "}
          <span className="text-slate-300">Risco</span> = quão sólida e
          previsível é? (dívida, estabilidade).{" "}
          <span className="text-slate-500">
            Confiança da nota: alta = 3 componentes calculados; média = 2
            (valuation entra quando o valor de mercado começar a ser coletado).
          </span>
          {dataRef && <> Notas de {dataRef}.</>}
        </p>

        <table className="mt-6 w-full text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-left text-slate-500">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Empresa</th>
              <th className="py-2 pr-3 text-right">Qualidade</th>
              <th className="py-2 pr-3 text-right">Valuation</th>
              <th className="py-2 pr-3 text-right">Risco</th>
              <th className="py-2 pr-3 text-right">Nota final</th>
              <th className="py-2 text-right">Confiança</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={s.ticker} className="border-b border-slate-900 hover:bg-slate-900/50">
                <td className="py-2 pr-3 text-slate-600">{i + 1}</td>
                <td className="py-2 pr-3">
                  <Link href={`/tese/${s.ticker}`} className="hover:underline">
                    <span className="font-mono font-semibold">{s.ticker}</span>
                    <span className="ml-2 text-slate-400">{s.empresas?.nome}</span>
                  </Link>
                </td>
                <td className={`py-2 pr-3 text-right ${corNota(s.qualidade)}`}>
                  {s.qualidade ?? "—"}
                </td>
                <td className={`py-2 pr-3 text-right ${corNota(s.valuation)}`}>
                  {s.valuation ?? "—"}
                </td>
                <td className={`py-2 pr-3 text-right ${corNota(s.risco)}`}>
                  {s.risco ?? "—"}
                </td>
                <td className={`py-2 pr-3 text-right text-lg font-bold ${corNota(s.score_final)}`}>
                  {s.score_final}
                </td>
                <td className="py-2 text-right text-xs text-slate-500">{s.confianca}</td>
              </tr>
            ))}
            {scores.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-slate-500">
                  Nenhum score ainda — rode a avaliação diária.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
