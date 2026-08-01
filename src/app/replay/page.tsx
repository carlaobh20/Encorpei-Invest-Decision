import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type EventoRow = {
  id: number;
  tipo: string;
  explicacao: string;
  criado_em: string;
  detalhe: Record<string, unknown> | null;
  teses: { ticker: string; empresas: { nome: string } | null } | null;
};

const TIPO_UI: Record<string, { rotulo: string; cor: string }> = {
  criacao: { rotulo: "Criação", cor: "bg-sky-500/60" },
  gatilho_disparado: { rotulo: "Gatilho", cor: "bg-red-500/70" },
  mudanca_status: { rotulo: "Status", cor: "bg-amber-500/70" },
  revisao: { rotulo: "Revisão", cor: "bg-emerald-500/70" },
};

function fmtData(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

export default async function Replay() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="min-h-dvh bg-slate-950 p-10 text-slate-100">
        Supabase não configurado.
      </main>
    );
  }

  const { data } = await supabase
    .from("eventos_tese")
    .select("id, tipo, explicacao, criado_em, detalhe, teses(ticker, empresas(nome))")
    .order("criado_em", { ascending: false })
    .limit(200);
  const eventos = (data as unknown as EventoRow[]) ?? [];

  return (
    <main className="h-dvh overflow-hidden bg-slate-950 text-slate-100 [background:radial-gradient(80%_60%_at_50%_0%,rgba(16,185,129,0.07),transparent),#020617]">
      <div className="mx-auto flex h-full max-w-4xl flex-col gap-3 px-6 py-4">
        <header className="flex items-end justify-between">
          <div>
            <Link href="/" className="text-[11px] uppercase tracking-[0.25em] text-slate-500 hover:text-emerald-400">
              ← Dashboard
            </Link>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Replay</h1>
            <p className="text-xs text-slate-500">
              Tudo o que o sistema viu, decidiu e explicou — em ordem, para
              sempre. É daqui que um dia você volta no tempo e pergunta:
              &quot;o que eu sabia naquele dia?&quot;
            </p>
          </div>
          <div className="flex gap-3 text-[10px] text-slate-500">
            {Object.entries(TIPO_UI).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${v.cor}`} />
                {v.rotulo}
              </span>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.03] p-5 pr-3">
          {eventos.map((e) => {
            const ui = TIPO_UI[e.tipo] ?? TIPO_UI.criacao;
            return (
              <div key={e.id} className="relative border-l border-white/10 pl-4">
                <span className={`absolute -left-[4.5px] top-1.5 h-2 w-2 rounded-full ${ui.cor}`} />
                <p className="text-[10px] uppercase tracking-wider text-slate-600">
                  {fmtData(e.criado_em)} ·{" "}
                  <Link
                    href={`/tese/${e.teses?.ticker}`}
                    className="font-mono text-emerald-500/80 hover:underline"
                  >
                    {e.teses?.ticker}
                  </Link>{" "}
                  {e.teses?.empresas?.nome && (
                    <span className="normal-case">· {e.teses.empresas.nome}</span>
                  )}{" "}
                  · {ui.rotulo}
                </p>
                <p className="mt-0.5 text-[13px] leading-snug text-slate-300">
                  {e.explicacao}
                </p>
              </div>
            );
          })}
          {eventos.length === 0 && (
            <p className="text-slate-500">Nenhum evento registrado ainda.</p>
          )}
        </div>
      </div>
    </main>
  );
}
