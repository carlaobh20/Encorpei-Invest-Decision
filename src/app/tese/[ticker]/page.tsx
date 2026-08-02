import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  METRICAS,
  fmtValor,
  regraEmPortugues,
  condicaoAtendida,
} from "@/lib/metricas";
import { GraficoBarras, rotuloTrimestre } from "@/components/GraficoBarras";
import { lerMomento } from "@/lib/tecnica";

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

type Score = {
  data: string;
  qualidade: number | null;
  valuation: number | null;
  risco: number | null;
  score_final: number;
  confianca: string;
  decomposicao: { componente: string; regra: string; valor: string; pontos: number }[];
};

const STATUS_UI: Record<string, { rotulo: string; cor: string; significado: string }> = {
  valida: {
    rotulo: "Válida",
    cor: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    significado: "os dados continuam confirmando a tese",
  },
  em_revisao: {
    rotulo: "Em revisão",
    cor: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    significado: "um sinal de alerta disparou — estude antes de decidir",
  },
  quebrada: {
    rotulo: "Quebrada",
    cor: "text-red-300 border-red-500/40 bg-red-500/10",
    significado: "a premissa central deixou de valer",
  },
};

function fmtData(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
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
      <main className="min-h-dvh bg-slate-950 p-10 text-slate-100">
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
      <main className="min-h-dvh bg-slate-950 p-10 text-slate-100">
        <p>
          Nenhuma tese ativa para {tickerUp}.{" "}
          <Link href="/teses" className="text-emerald-400 hover:underline">← voltar</Link>
        </p>
      </main>
    );
  }

  const metricasAtuais: Record<string, number | null> = {
    roic: null, margem_liquida: null, divida_liquida: null, queda_preco_30d: null,
  };
  const [{ data: fund }, { data: precos }, { data: gatilhos }, { data: eventos }, { data: scoreRows }] =
    await Promise.all([
      supabase
        .from("fundamentos")
        .select("competencia, fonte, roic, margem_liquida, divida_liquida, receita_liquida")
        .eq("ticker", tese.ticker)
        .order("competencia", { ascending: false })
        .limit(8),
      supabase
        .from("precos_diarios")
        .select("data, fechamento")
        .eq("ticker", tese.ticker)
        .gte("data", new Date(Date.now() - 150 * 86_400_000).toISOString().slice(0, 10))
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
        .limit(30),
      supabase
        .from("scores")
        .select("data, qualidade, valuation, risco, score_final, confianca, decomposicao")
        .eq("ticker", tese.ticker)
        .order("data", { ascending: false })
        .limit(1),
    ]);

  if (fund?.[0]) {
    metricasAtuais.margem_liquida = fund[0].margem_liquida;
    metricasAtuais.divida_liquida = fund[0].divida_liquida;
    const roicsTri = fund
      .filter((f) => f.fonte === "cvm_itr" && f.roic !== null)
      .slice(0, 4)
      .map((f) => Number(f.roic));
    metricasAtuais.roic = roicsTri.length
      ? roicsTri.reduce((a, b) => a + b, 0) / roicsTri.length
      : fund[0].roic;
  }
  const desde30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  const precos30 = (precos ?? []).filter((p) => p.data >= desde30);
  if (precos30.length >= 5) {
    const max = Math.max(...precos30.map((p) => Number(p.fechamento)));
    const ultimo = Number(precos30[precos30.length - 1].fechamento);
    if (max > 0) metricasAtuais.queda_preco_30d = (max - ultimo) / max;
  }
  const momento = lerMomento((precos ?? []).map((p) => Number(p.fechamento)));
  const competencia = fund?.[0]?.competencia
    ? String(fund[0].competencia).split("-").reverse().join("/")
    : null;
  const score = scoreRows?.[0] as Score | undefined;
  const ui = STATUS_UI[tese.status] ?? STATUS_UI.valida;

  return (
    <main className="h-dvh overflow-hidden bg-slate-950 text-slate-100 [background:radial-gradient(80%_60%_at_50%_0%,rgba(16,185,129,0.07),transparent),radial-gradient(60%_50%_at_100%_100%,rgba(59,130,246,0.05),transparent),#020617]">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 px-6 py-4">
        {/* ---------- cabeçalho ---------- */}
        <header className="flex items-end justify-between">
          <div>
            <Link href="/teses" className="text-[11px] uppercase tracking-[0.25em] text-slate-500 hover:text-emerald-400">
              ← Teses Vivas
            </Link>
            <div className="mt-1 flex items-baseline gap-3">
              <h1 className="text-3xl font-bold tracking-tight">
                <span className="font-mono">{tese.ticker}</span>
              </h1>
              <span className="text-lg text-slate-400">{tese.empresas?.nome}</span>
              <span className="text-xs text-slate-600">
                v{tese.versao} · convicção {tese.confianca}
                {competencia && <> · dados de {competencia}</>}
              </span>
            </div>
          </div>
          <div className="text-right">
            <span className={`rounded-full border px-4 py-1.5 text-sm font-medium ${ui.cor}`}>
              {ui.rotulo}
            </span>
            <p className="mt-1 text-[11px] text-slate-500">{ui.significado}</p>
          </div>
        </header>

        {/* ---------- corpo em grade, sem rolagem de página ---------- */}
        <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
          {/* coluna esquerda: tese + nota */}
          <div className="col-span-12 flex min-h-0 flex-col gap-3 lg:col-span-5">
            <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">A tese</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-slate-200">{tese.texto}</p>
            </section>

            {score && (
              <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-5">
                <div className="flex items-center gap-5">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-2 border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.15)]">
                    <span className="text-3xl font-bold text-emerald-300">{score.score_final}</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                      Nota do Decision Engine
                    </h2>
                    <div className="mt-2 flex gap-6 text-center">
                      {([["Qualidade", score.qualidade], ["Valuation", score.valuation], ["Risco", score.risco]] as [string, number | null][]).map(
                        ([nome, v]) => (
                          <div key={nome}>
                            <p className="text-lg font-semibold text-slate-200">{v ?? "—"}</p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-500">{nome}</p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[11px] text-slate-500">
                  Calculada por regras fixas e versionadas — nunca por opinião. Confiança {score.confianca}.
                </p>
                <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
                  {score.decomposicao.map((d, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-1.5 text-[11px]">
                      <span className="text-slate-400">
                        <span className="mr-1.5 uppercase text-slate-600">{d.componente.slice(0, 4)}</span>
                        {d.regra}
                      </span>
                      <span className="ml-3 shrink-0 text-slate-500">
                        {d.valor} → <span className="font-semibold text-slate-200">{d.pontos}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* coluna direita: gatilhos + linha do tempo */}
          <div className="col-span-12 flex min-h-0 flex-col gap-3 lg:col-span-7">
            <section>
              <div className="flex items-baseline justify-between">
                <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                  Gatilhos vigiados
                </h2>
                <p className="text-[10px] text-slate-600">
                  <span className="text-red-400/80">vermelho</span> = deterioração ·{" "}
                  <span className="text-emerald-400/80">verde</span> = oportunidade · conferidos todo dia útil
                </p>
              </div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(gatilhos as Gatilho[] | null)?.map((g) => {
                  const info = METRICAS[g.metrica];
                  const atual = metricasAtuais[g.metrica];
                  const disparado =
                    atual !== null && atual !== undefined &&
                    condicaoAtendida(g.operador, Number(atual), Number(g.valor));
                  return (
                    <div
                      key={g.id}
                      className={`rounded-xl border p-3 ${
                        g.direcao === "negativo"
                          ? "border-red-500/15 bg-red-500/[0.04]"
                          : "border-emerald-500/15 bg-emerald-500/[0.04]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-medium">{info?.nome ?? g.metrica}</p>
                        {disparado && (
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            g.direcao === "negativo"
                              ? "bg-red-500/20 text-red-300"
                              : "bg-emerald-500/20 text-emerald-300"
                          }`}>
                            DISPARADO
                          </span>
                        )}
                      </div>
                      <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-slate-500">
                        {info?.explicacao}
                      </p>
                      <div className="mt-2 flex items-center justify-between text-[12px]">
                        <span className="text-slate-400">
                          {regraEmPortugues(g.metrica, g.operador, Number(g.valor))}
                        </span>
                        <span className="ml-2 shrink-0 rounded-md bg-white/[0.05] px-2 py-0.5 font-mono text-slate-300">
                          {atual === null || atual === undefined
                            ? "sem dado"
                            : fmtValor(g.metrica, Number(atual))}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ---------- momento (leitura técnica) ---------- */}
            <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                  Momento — leitura técnica do preço
                </h2>
                <p className="text-[10px] text-slate-600">
                  descreve o preço; a decisão continua sua — fundamento primeiro
                </p>
              </div>
              {momento.prontos.length > 0 ? (
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {momento.prontos.map((m) => (
                    <div
                      key={m.indicador}
                      className={`rounded-xl border p-2.5 ${
                        m.tom === "atencao_positiva"
                          ? "border-sky-400/20 bg-sky-500/[0.05]"
                          : m.tom === "atencao_negativa"
                            ? "border-amber-500/20 bg-amber-500/[0.05]"
                            : "border-white/5 bg-white/[0.02]"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] font-medium text-slate-300">{m.indicador}</p>
                        <span className="shrink-0 rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-[12px] text-slate-200">
                          {m.valor}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] leading-snug text-slate-500">{m.leitura}</p>
                    </div>
                  ))}
                </div>
              ) : null}
              {momento.pendentes.length > 0 && (
                <p className="mt-2 text-[10.5px] leading-snug text-slate-600">
                  Acendem sozinhos conforme os pregões acumulam:{" "}
                  {momento.pendentes.join(" · ")}.
                </p>
              )}
            </section>

            {(() => {
              const tri = (fund ?? [])
                .filter((f) => f.fonte === "cvm_itr")
                .slice(0, 6)
                .reverse();
              if (tri.length < 2) return null;
              const pontos = (campo: "receita_liquida" | "margem_liquida" | "roic") =>
                tri.map((f) => ({
                  rotulo: rotuloTrimestre(String(f.competencia)),
                  valor: f[campo] !== null ? Number(f[campo]) : null,
                }));
              return (
                <section className="grid grid-cols-3 gap-2">
                  <GraficoBarras titulo="Receita / tri" formato="reais" altura={80}
                    series={[{ nome: tese.ticker, cor: "#059669", pontos: pontos("receita_liquida") }]} />
                  <GraficoBarras titulo="Margem líquida" formato="percentual" altura={80}
                    series={[{ nome: tese.ticker, cor: "#059669", pontos: pontos("margem_liquida") }]} />
                  <GraficoBarras titulo="ROIC (pós-imposto)" formato="percentual" altura={80}
                    series={[{ nome: tese.ticker, cor: "#059669", pontos: pontos("roic") }]} />
                </section>
              );
            })()}

            <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <div className="flex items-baseline justify-between">
                <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                  Linha do tempo
                </h2>
                <p className="text-[10px] text-slate-600">
                  registro imutável — ninguém edita o passado, nem o sistema
                </p>
              </div>
              <div className="mt-2 min-h-0 flex-1 space-y-2.5 overflow-y-auto border-l border-white/10 pl-4 pr-1">
                {(eventos as Evento[] | null)?.map((e) => (
                  <div key={e.id} className="relative">
                    <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-emerald-500/60" />
                    <p className="text-[10px] uppercase tracking-wider text-slate-600">
                      {fmtData(e.criado_em)} · {e.tipo.replace(/_/g, " ")}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-snug text-slate-300">{e.explicacao}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
