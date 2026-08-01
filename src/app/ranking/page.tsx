import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";

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
  if (n >= 80) return "text-emerald-300";
  if (n >= 60) return "text-emerald-500";
  if (n >= 40) return "text-amber-400";
  return "text-red-400";
}

function corBarra(n: number): string {
  if (n >= 80) return "bg-emerald-400";
  if (n >= 60) return "bg-emerald-600";
  if (n >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export default async function Ranking() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/ranking" titulo="Ranking">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

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
    <Shell
      ativo="/ranking"
      titulo="Ranking do universo"
      subtitulo={`Nota de 0 a 100 por regras fixas e versionadas — nunca por opinião, nunca por IA. Qualidade = o negócio é bom? · Valuation = o preço está razoável? · Risco = quão sólida é? ${dataRef ? `Notas de ${dataRef}.` : ""}`}
    >
      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.03] p-4 pr-2">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10 bg-[#050b18]/95 backdrop-blur">
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
              <th className="py-2 pr-3">#</th>
              <th className="py-2 pr-3">Empresa</th>
              <th className="py-2 pr-3 text-right">Qualidade</th>
              <th className="py-2 pr-3 text-right">Valuation</th>
              <th className="py-2 pr-3 text-right">Risco</th>
              <th className="w-[26%] py-2 pr-3">Nota final</th>
              <th className="py-2 text-right">Confiança</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((s, i) => (
              <tr key={s.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                <td className="py-2.5 pr-3 text-slate-600">{i + 1}</td>
                <td className="py-2.5 pr-3">
                  <Link href={`/tese/${s.ticker}`} className="hover:underline">
                    <span className="font-mono font-semibold">{s.ticker}</span>
                    <span className="ml-2 text-slate-400">{s.empresas?.nome}</span>
                  </Link>
                </td>
                <td className={`py-2.5 pr-3 text-right font-mono ${corNota(s.qualidade)}`}>
                  {s.qualidade ?? "—"}
                </td>
                <td className={`py-2.5 pr-3 text-right font-mono ${corNota(s.valuation)}`}>
                  {s.valuation ?? "—"}
                </td>
                <td className={`py-2.5 pr-3 text-right font-mono ${corNota(s.risco)}`}>
                  {s.risco ?? "—"}
                </td>
                <td className="py-2.5 pr-3">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className={`h-full rounded-full ${corBarra(s.score_final)}`}
                        style={{ width: `${s.score_final}%` }}
                      />
                    </div>
                    <span className={`w-8 text-right text-base font-bold ${corNota(s.score_final)}`}>
                      {s.score_final}
                    </span>
                  </div>
                </td>
                <td className="py-2.5 text-right text-[11px] text-slate-500">{s.confianca}</td>
              </tr>
            ))}
            {scores.length === 0 && (
              <tr>
                <td colSpan={7} className="py-6 text-slate-500">
                  Sem notas ainda — rode a avaliação diária.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
