import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

type EventoTM = {
  id: number;
  tipo: string;
  explicacao: string;
  criado_em: string;
  detalhe: { de?: string; para?: string } | null;
  teses: { id: string; ticker: string } | null;
};
type ScoreTM = { ticker: string; data: string; score_final: number };
type PrecoTM = { ticker: string; data: string; fechamento: number };
type TeseTM = { id: string; ticker: string; criado_em: string; empresas: { nome: string } | null };

const STATUS_CHIP: Record<string, string> = {
  valida: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  em_revisao: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  quebrada: "text-red-300 bg-red-500/10 border-red-500/30",
  inexistente: "text-slate-500 bg-white/5 border-white/10",
};
const STATUS_TXT: Record<string, string> = {
  valida: "Válida",
  em_revisao: "Revisão",
  quebrada: "Quebrada",
  inexistente: "ainda não existia",
};

function fmtHora(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

export default async function TimeMachine({
  searchParams,
}: {
  searchParams: Promise<{ d?: string }>;
}) {
  const sp = await searchParams;
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/timemachine" titulo="Time Machine">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const hojeSP = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") ? (sp.d as string) : hojeSP;
  const fimDoDia = `${dia}T23:59:59-03:00`;

  const [{ data: tesesRaw }, { data: eventosRaw }, { data: scoresRaw }, { data: precosRaw }] =
    await Promise.all([
      supabase.from("teses")
        .select("id, ticker, criado_em, empresas(nome)")
        .eq("ativa", true).order("ticker"),
      supabase.from("eventos_tese")
        .select("id, tipo, explicacao, criado_em, detalhe, teses(id, ticker)")
        .lte("criado_em", fimDoDia)
        .order("criado_em", { ascending: true })
        .limit(500),
      supabase.from("scores")
        .select("ticker, data, score_final")
        .lte("data", dia)
        .order("data", { ascending: false })
        .limit(300),
      supabase.from("precos_diarios")
        .select("ticker, data, fechamento")
        .lte("data", dia)
        .order("data", { ascending: false })
        .limit(300),
    ]);

  const teses = (tesesRaw as unknown as TeseTM[]) ?? [];
  const eventos = (eventosRaw as unknown as EventoTM[]) ?? [];

  // REPLAY: reconstrói o status de cada tese aplicando os eventos até o dia
  const statusNoDia = new Map<string, string>();
  for (const t of teses) {
    if (new Date(t.criado_em) > new Date(fimDoDia)) {
      statusNoDia.set(t.ticker, "inexistente");
    } else {
      statusNoDia.set(t.ticker, "valida"); // toda tese nasce válida
    }
  }
  for (const e of eventos) {
    const ticker = e.teses?.ticker;
    if (!ticker || e.tipo !== "mudanca_status" || !e.detalhe?.para) continue;
    if (statusNoDia.get(ticker) !== "inexistente") {
      statusNoDia.set(ticker, e.detalhe.para);
    }
  }

  // último score e preço conhecidos até o dia
  const scoreNoDia = new Map<string, number>();
  for (const s of (scoresRaw as ScoreTM[]) ?? []) {
    if (!scoreNoDia.has(s.ticker)) scoreNoDia.set(s.ticker, Number(s.score_final));
  }
  const precoNoDia = new Map<string, number>();
  for (const p of (precosRaw as PrecoTM[]) ?? []) {
    if (!precoNoDia.has(p.ticker)) precoNoDia.set(p.ticker, Number(p.fechamento));
  }

  const linhas = teses
    .map((t) => ({
      ticker: t.ticker,
      nome: t.empresas?.nome ?? "",
      status: statusNoDia.get(t.ticker) ?? "inexistente",
      score: scoreNoDia.get(t.ticker) ?? null,
      preco: precoNoDia.get(t.ticker) ?? null,
    }))
    .sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

  const eventosDoDia = eventos
    .filter((e) => e.criado_em.slice(0, 10) === dia)
    .reverse();
  const diaBR = dia.split("-").reverse().join("/");

  return (
    <Shell
      ativo="/timemachine"
      titulo="Time Machine"
      subtitulo="Volte para qualquer data e veja o que o sistema sabia naquele dia — status reconstruído evento por evento a partir do histórico imutável. Nada aqui é lembrança: é replay."
    >
      <form method="GET" className="flex items-center gap-3 text-sm">
        <label className="text-slate-400">Viajar para:</label>
        <input
          type="date"
          name="d"
          defaultValue={dia}
          max={hojeSP}
          min="2026-07-31"
          className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 [color-scheme:dark] focus:border-emerald-500/50 focus:outline-none"
        />
        <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500">
          Reconstruir
        </button>
        <p className="text-[11px] text-slate-600">
          O sistema nasceu em 31/07/2026 — cada dia vivido vira um destino possível.
        </p>
      </form>

      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        <section className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4 lg:col-span-7">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            O universo em {diaBR}
          </h2>
          <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
            <table className="w-full text-[13px]">
              <thead className="sticky top-0 bg-[#050b18]/95 backdrop-blur">
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="py-1.5 pr-2">Empresa</th>
                  <th className="py-1.5 pr-2">Tese naquele dia</th>
                  <th className="py-1.5 pr-2 text-right">Preço</th>
                  <th className="py-1.5 text-right">Nota</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                    <td className="py-2 pr-2">
                      <Link href={`/tese/${l.ticker}`} className="hover:underline">
                        <span className="font-mono font-semibold">{l.ticker}</span>
                        <span className="ml-2 text-slate-400">{l.nome}</span>
                      </Link>
                    </td>
                    <td className="py-2 pr-2">
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] ${STATUS_CHIP[l.status]}`}>
                        {STATUS_TXT[l.status]}
                      </span>
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">
                      {l.preco !== null
                        ? l.preco.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—"}
                    </td>
                    <td className="py-2 text-right text-base font-bold text-emerald-400">
                      {l.score ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4 lg:col-span-5">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            O que aconteceu em {diaBR}
          </h2>
          <div className="mt-2 min-h-0 flex-1 space-y-2.5 overflow-y-auto border-l border-white/10 pl-4 pr-1">
            {eventosDoDia.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum evento neste dia — nenhum gatilho disparou, nenhuma tese
                mudou. Dias assim também contam a história.
              </p>
            )}
            {eventosDoDia.map((e) => (
              <div key={e.id} className="relative">
                <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-emerald-500/60" />
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  {fmtHora(e.criado_em)} ·{" "}
                  <span className="font-mono text-emerald-500/80">{e.teses?.ticker}</span>{" "}
                  · {e.tipo.replace(/_/g, " ")}
                </p>
                <p className="mt-0.5 line-clamp-3 text-[12px] leading-snug text-slate-300">
                  {e.explicacao}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}
