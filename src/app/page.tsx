import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Sparkline } from "@/components/Sparkline";

export const dynamic = "force-dynamic";

type ScoreRow = {
  ticker: string;
  data: string;
  score_final: number;
  confianca: string;
  empresas: { nome: string } | null;
};
type TeseRow = { ticker: string; status: string };
type EventoRow = {
  id: number;
  tipo: string;
  explicacao: string;
  criado_em: string;
  teses: { ticker: string } | null;
};
type PrecoRow = { ticker: string; data: string; fechamento: number };

const STATUS_CHIP: Record<string, string> = {
  valida: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  em_revisao: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  quebrada: "text-red-300 bg-red-500/10 border-red-500/30",
};
const STATUS_TXT: Record<string, string> = {
  valida: "Válida",
  em_revisao: "Revisão",
  quebrada: "Quebrada",
};

function corNota(n: number): string {
  if (n >= 80) return "text-emerald-300";
  if (n >= 60) return "text-emerald-500";
  if (n >= 40) return "text-amber-400";
  return "text-red-400";
}

function fmtHora(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function Dashboard() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="min-h-dvh bg-slate-950 p-10 text-slate-100">
        <h1 className="text-3xl font-bold">Encorpei Invest</h1>
        <p className="mt-2 text-slate-400">Supabase não configurado.</p>
      </main>
    );
  }

  const desde45d = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const desde48h = new Date(Date.now() - 48 * 3_600_000).toISOString();

  const [{ data: scoresRaw }, { data: tesesRaw }, { data: eventosRaw }, { data: precosRaw }] =
    await Promise.all([
      supabase
        .from("scores")
        .select("ticker, data, score_final, confianca, empresas(nome)")
        .order("data", { ascending: false })
        .limit(200),
      supabase.from("teses").select("ticker, status").eq("ativa", true),
      supabase
        .from("eventos_tese")
        .select("id, tipo, explicacao, criado_em, teses(ticker)")
        .gte("criado_em", desde48h)
        .order("criado_em", { ascending: false })
        .limit(12),
      supabase
        .from("precos_diarios")
        .select("ticker, data, fechamento")
        .gte("data", desde45d)
        .order("data", { ascending: false }),
    ]);

  // score mais recente por ticker
  const vistos = new Set<string>();
  const ranking: ScoreRow[] = [];
  for (const s of (scoresRaw as unknown as ScoreRow[]) ?? []) {
    if (!vistos.has(s.ticker)) {
      vistos.add(s.ticker);
      ranking.push(s);
    }
  }
  ranking.sort((a, b) => b.score_final - a.score_final);

  const statusPorTicker = new Map(
    ((tesesRaw as TeseRow[]) ?? []).map((t) => [t.ticker, t.status])
  );

  // histórico por ticker (desc): [0] = mais recente; série completa p/ sparkline
  const precosPorTicker = new Map<string, PrecoRow[]>();
  for (const p of (precosRaw as PrecoRow[]) ?? []) {
    const arr = precosPorTicker.get(p.ticker) ?? [];
    if (!arr.find((x) => x.data === p.data)) arr.push(p);
    precosPorTicker.set(p.ticker, arr);
  }

  const eventos = (eventosRaw as unknown as EventoRow[]) ?? [];
  const emRevisao = ranking.filter(
    (r) => statusPorTicker.get(r.ticker) === "em_revisao"
  ).length;
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <main className="h-dvh overflow-hidden bg-slate-950 text-slate-100 [background:radial-gradient(80%_60%_at_50%_0%,rgba(16,185,129,0.07),transparent),radial-gradient(60%_50%_at_100%_100%,rgba(59,130,246,0.05),transparent),#020617]">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 px-6 py-4">
        {/* ---------- cabeçalho ---------- */}
        <header className="flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Encorpei <span className="text-emerald-400">Invest</span>
            </h1>
            <p className="text-xs capitalize text-slate-500">{hoje}</p>
          </div>
          <nav className="flex items-center gap-2 text-xs">
            <Link href="/teses" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300">Teses</Link>
            <Link href="/ranking" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300">Ranking</Link>
            <Link href="/diario" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300">Diário</Link>
            <Link href="/replay" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300">Replay</Link>
            <Link href="/auditoria" className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300">Auditoria</Link>
          </nav>
        </header>

        {/* ---------- resumo do dia ---------- */}
        <div className="flex gap-3">
          <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2">
            <p className="text-lg font-bold text-slate-100">{ranking.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">teses vigiadas</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2">
            <p className={`text-lg font-bold ${emRevisao > 0 ? "text-amber-300" : "text-emerald-300"}`}>
              {emRevisao}
            </p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">em revisão</p>
          </div>
          <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2">
            <p className="text-lg font-bold text-slate-100">{eventos.length}</p>
            <p className="text-[10px] uppercase tracking-wider text-slate-500">eventos 48h</p>
          </div>
          <div className="ml-auto self-center text-right text-[11px] text-slate-600">
            Sistema de apoio à decisão de uso pessoal.<br />
            Não constitui recomendação de investimento.
          </div>
        </div>

        {/* ---------- corpo ---------- */}
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
          {/* o que mudou */}
          <section className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4 lg:col-span-5">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
              O que mudou (48h)
            </h2>
            <div className="mt-2 min-h-0 flex-1 space-y-2.5 overflow-y-auto border-l border-white/10 pl-4 pr-1">
              {eventos.length === 0 && (
                <p className="text-sm text-slate-500">
                  Nada mudou — nenhum gatilho disparou. Dia tranquilo é o
                  sistema dizendo: suas teses seguem de pé.
                </p>
              )}
              {eventos.map((e) => (
                <div key={e.id} className="relative">
                  <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-emerald-500/60" />
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">
                    {fmtHora(e.criado_em)} ·{" "}
                    <Link href={`/tese/${e.teses?.ticker}`} className="font-mono text-emerald-500/80 hover:underline">
                      {e.teses?.ticker}
                    </Link>{" "}
                    · {e.tipo.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-slate-300">
                    {e.explicacao}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* ranking do dia */}
          <section className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4 lg:col-span-7">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                Universo por nota
              </h2>
              <p className="text-[10px] text-slate-600">clique para abrir a tese</p>
            </div>
            <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
              <table className="w-full text-[13px]">
                <thead className="sticky top-0 bg-slate-950/90 backdrop-blur">
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                    <th className="py-1.5 pr-2">Empresa</th>
                    <th className="py-1.5 pr-2">Tese</th>
                    <th className="py-1.5 pr-2 text-right">Preço</th>
                    <th className="py-1.5 pr-2 text-right">Dia</th>
                    <th className="py-1.5 pr-2 text-right">30d</th>
                    <th className="py-1.5 text-right">Nota</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((s) => {
                    const st = statusPorTicker.get(s.ticker) ?? "valida";
                    const ps = precosPorTicker.get(s.ticker) ?? [];
                    const preco = ps[0]?.fechamento ? Number(ps[0].fechamento) : null;
                    const anterior = ps[1]?.fechamento ? Number(ps[1].fechamento) : null;
                    const varDia =
                      preco !== null && anterior !== null && anterior > 0
                        ? (preco - anterior) / anterior
                        : null;
                    return (
                      <tr key={s.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                        <td className="py-2 pr-2">
                          <Link href={`/tese/${s.ticker}`} className="hover:underline">
                            <span className="font-mono font-semibold">{s.ticker}</span>
                            <span className="ml-2 text-slate-400">{s.empresas?.nome}</span>
                          </Link>
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_CHIP[st]}`}>
                            {STATUS_TXT[st]}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-right font-mono text-slate-300">
                          {preco !== null
                            ? preco.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : "—"}
                        </td>
                        <td className={`py-2 pr-2 text-right font-mono ${
                          varDia === null ? "text-slate-600"
                          : varDia >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}>
                          {varDia === null
                            ? "—"
                            : `${varDia >= 0 ? "+" : ""}${(varDia * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                        </td>
                        <td className="py-2 pr-2 text-right">
                          <Sparkline
                            valores={[...ps].reverse().map((p) => Number(p.fechamento))}
                          />
                        </td>
                        <td className={`py-2 text-right text-base font-bold ${corNota(s.score_final)}`}>
                          {s.score_final}
                        </td>
                      </tr>
                    );
                  })}
                  {ranking.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-slate-500">
                        Sem notas ainda — rode a avaliação diária.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
