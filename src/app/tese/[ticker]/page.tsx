import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  METRICAS,
  fmtValor,
  regraEmPortugues,
  condicaoAtendida,
} from "@/lib/metricas";

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

const STATUS_UI: Record<
  string,
  { rotulo: string; cor: string; significado: string }
> = {
  valida: {
    rotulo: "Válida",
    cor: "text-emerald-400 border-emerald-700",
    significado: "os dados continuam confirmando a tese",
  },
  em_revisao: {
    rotulo: "Em revisão",
    cor: "text-amber-400 border-amber-700",
    significado: "um sinal de alerta disparou — estude antes de decidir",
  },
  quebrada: {
    rotulo: "Quebrada",
    cor: "text-red-400 border-red-700",
    significado: "a premissa central deixou de valer",
  },
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

  // métricas ATUAIS do ticker (mesma lógica do motor de gatilhos)
  const metricasAtuais: Record<string, number | null> = {
    roic: null, margem_liquida: null, divida_liquida: null, queda_preco_30d: null,
  };
  const [{ data: fund }, { data: precos }, { data: gatilhos }, { data: eventos }] =
    await Promise.all([
      supabase
        .from("fundamentos")
        .select("competencia, roic, margem_liquida, divida_liquida")
        .eq("ticker", tese.ticker)
        .order("competencia", { ascending: false })
        .limit(1),
      supabase
        .from("precos_diarios")
        .select("data, fechamento")
        .eq("ticker", tese.ticker)
        .gte("data", new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
        .order("data", { ascending: true }),
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

  if (fund?.[0]) {
    metricasAtuais.roic = fund[0].roic;
    metricasAtuais.margem_liquida = fund[0].margem_liquida;
    metricasAtuais.divida_liquida = fund[0].divida_liquida;
  }
  if (precos && precos.length >= 5) {
    const max = Math.max(...precos.map((p) => Number(p.fechamento)));
    const ultimo = Number(precos[precos.length - 1].fechamento);
    if (max > 0) metricasAtuais.queda_preco_30d = (max - ultimo) / max;
  }
  const competencia = fund?.[0]?.competencia
    ? String(fund[0].competencia).split("-").reverse().join("/")
    : null;

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
        <p className="mt-2 text-sm text-slate-400">
          Status &quot;{ui.rotulo}&quot; = {ui.significado}.
        </p>

        <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">
            A tese
          </h2>
          <p className="mt-3 leading-relaxed text-slate-200">{tese.texto}</p>
        </section>

        <section className="mt-8">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">
            Gatilhos vigiados
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            <span className="text-red-400">Vermelhos</span> = sinais de que a
            tese pode estar se deteriorando ·{" "}
            <span className="text-emerald-400">Verdes</span> = possíveis
            oportunidades. O robô confere todos, todo dia útil, sozinho.
            {competencia && (
              <> Dados fundamentais do trimestre encerrado em {competencia}.</>
            )}
          </p>

          <div className="mt-4 space-y-3">
            {(gatilhos as Gatilho[] | null)?.map((g) => {
              const info = METRICAS[g.metrica];
              const atual = metricasAtuais[g.metrica];
              const disparado =
                atual !== null &&
                atual !== undefined &&
                condicaoAtendida(g.operador, Number(atual), Number(g.valor));
              return (
                <div
                  key={g.id}
                  className={`rounded-xl border p-4 ${
                    g.direcao === "negativo"
                      ? "border-red-900/60 bg-red-950/20"
                      : "border-emerald-900/60 bg-emerald-950/20"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {info?.nome ?? g.metrica}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        {info?.explicacao}
                      </p>
                    </div>
                    {disparado && (
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                          g.direcao === "negativo"
                            ? "bg-red-900/60 text-red-300"
                            : "bg-emerald-900/60 text-emerald-300"
                        }`}
                      >
                        DISPARADO
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                    <span className="text-slate-300">
                      {regraEmPortugues(g.metrica, g.operador, Number(g.valor))}
                    </span>
                    <span className="text-slate-500">
                      Hoje:{" "}
                      <span className={disparado ? "font-semibold text-slate-200" : ""}>
                        {atual === null || atual === undefined
                          ? "ainda sem dado"
                          : fmtValor(g.metrica, Number(atual))}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mt-8">
          <h2 className="text-sm uppercase tracking-widest text-slate-500">
            Linha do tempo (imutável)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Cada acontecimento fica registrado para sempre, com a explicação e
            os dados da causa — ninguém edita o passado, nem o sistema.
          </p>
          <div className="mt-3 space-y-3 border-l border-slate-800 pl-4">
            {(eventos as Evento[] | null)?.map((e) => (
              <div key={e.id}>
                <p className="text-xs text-slate-500">
                  {fmtData(e.criado_em)} ·{" "}
                  <span className="uppercase">{e.tipo.replace(/_/g, " ")}</span>
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
