import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Gatilho = {
  id: string;
  descricao: string;
  metrica: string;
  operador: string;
  valor: number;
  direcao: string;
  ativo: boolean;
};

type Evento = {
  id: number;
  tipo: string;
  explicacao: string;
  criado_em: string;
};

const STATUS_UI: Record<string, { rotulo: string; cor: string }> = {
  valida: { rotulo: "Válida", cor: "text-emerald-400 border-emerald-700" },
  em_revisao: { rotulo: "Em revisão", cor: "text-amber-400 border-amber-700" },
  quebrada: { rotulo: "Quebrada", cor: "text-red-400 border-red-700" },
};

function fmtData(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

export default async function TesePage({
  params,
}: {
  params: Promise<{ ticker: string }>;
}) {
  const { ticker } = await params;
  const tickerUp = ticker.toUpperCase();

  if (!isSupabaseConfigured || !supabase) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-10">
        Supabase não configurado.
      </main>
    );
  }

  const { data: teses } = await supabase
    .from("teses")
    .select("id, ticker, versao, status, confianca, texto, criado_em, empresas(nome, setor)")
    .eq("ticker", tickerUp)
    .eq("ativa", true)
    .limit(1);
  const tese = teses?.[0] as
    | {
        id: string; ticker: string; versao: number; status: string;
        confianca: string; texto: string; criado_em: string;
        empresas: { nome: string; setor: string | null } | null;
      }
    | undefined;

  if (!tese) {
    return (
      <main className="min-h-screen bg-slate-950 text-slate-100 p-10">
        <p>
          Nenhuma tese ativa para {tickerUp}.{" "}
          <Link href="/teses" className="text-emerald-400 hover:underline">
            ← voltar
          </Link>
        </p>
      </main>
    );
  }

  const [{ data: gatilhos }, { data: eventos }] = await Promise.all([
    supabase
      .from("gatilhos")
      .select("id, descricao, metrica, operador, valor, direcao, ativo")
      .eq("tese_id", tese.id)
      .order("direcao"),
    supabase
      .from("eventos_tese")
      .select("id, tipo, explicacao, criado_em")
      .eq("tese_id", tese.id)
      .order("criado_em", { ascending: false })
      .limit(50),
  ]);

  const ui = STATUS_UI[tese.status] ?? STATUS_UI.valida;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-3xl">
        <Link href="/teses" className="text-xs text-slate-500 hover:text-slate-300">
          ← todas as teses
        </Link>

        <div className="mt-4 flex items-center justify-between">
          <h1 className="text-3xl font-bold">
            <span className="font-mono">{tese.ticker}</span>
            <span className="ml-3 text-xl font-normal text-slate-400">
              {tese.empresas?.nome}
            </span>
          </h1>
          <span className={`rounded-full border px-4 py-1 text-sm ${ui.cor}`}>
            {ui.rotulo}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Tese v{tese.versao} · Convicção: {tese.confianca} · criada em{" "}
          {fmtData(tese.criado_em)}
        </p>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">
            A tese
          </h2>
          <p className="mt-3 leading-relaxed text-slate-200">{tese.texto}</p>
        </section>

        <section className="mt-6">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">
            Gatilhos vigiados
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {(gatilhos as Gatilho[] | null)?.map((g) => (
              <div
                key={g.id}
                className={`rounded-lg border p-3 text-sm ${
                  g.direcao === "negativo"
                    ? "border-red-900/60 bg-red-950/20"
                    : "border-emerald-900/60 bg-emerald-950/20"
                }`}
              >
                <p className="font-medium">{g.descricao}</p>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {g.metrica} {g.operador} {g.valor}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">
            Linha do tempo (imutável)
          </h2>
          <div className="mt-3 space-y-3 border-l border-slate-800 pl-4">
            {(eventos as Evento[] | null)?.map((e) => (
              <div key={e.id}>
                <p className="text-xs text-slate-500">
                  {fmtData(e.criado_em)} ·{" "}
                  <span className="uppercase">{e.tipo.replace("_", " ")}</span>
                </p>
                <p className="mt-1 text-sm text-slate-300">{e.explicacao}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
