import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { Sparkline } from "@/components/Sparkline";
import { calcularRadar, candidatas } from "@/lib/radar";
import { consolidarCarteira, type Posicao } from "@/lib/carteira";
import { calcularPatrimonio } from "@/lib/patrimonio-dados";
import { calcularTechnicals } from "@/lib/technical-dados";
import { gerarDecisionFeed, ROTULO_SUGESTAO, type DecisionFeedEntrada, type SugestaoFeed } from "@/lib/decision-feed";

export const dynamic = "force-dynamic";

/**
 * MEU PATRIMÔNIO (PIC 01, 03/08/2026) — a home responde em 5 segundos:
 * meu patrimônio está crescendo acima da inflação? · preciso agir? ·
 * o que mudou? · o que merece minha atenção?
 * Regra inegociável: todo número é REAL (banco/regras) ou o card diz
 * "em construção"/"registre X para habilitar" com o que destrava. Nada
 * decorativo, nada inventado. Tudo que já existia no Decision Center
 * continua aqui — só ganhou um andar novo em cima: o patrimônio.
 */

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
type DecisaoRow = { id: number; ticker: string; decisao: string; criado_em: string };

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
const DECISAO_TXT: Record<string, string> = {
  comprei: "Comprei", aumentei: "Aumentei", reduzi: "Reduzi",
  vendi: "Vendi", mantive: "Mantive", observei: "Só observei",
};
const SUGESTAO_COR: Record<SugestaoFeed, string> = {
  aumentar_prioridade: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  reduzir_prioridade: "border-red-500/30 bg-red-500/10 text-red-200",
  aguardar_melhor_ponto: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  nenhuma_acao: "border-white/10 bg-white/[0.03] text-slate-400",
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

function Card({
  titulo, acao, children, futuro,
}: {
  titulo: string; acao?: { href: string; rotulo: string };
  children: React.ReactNode; futuro?: boolean;
}) {
  return (
    <section className={`flex flex-col rounded-2xl border p-4 ${
      futuro ? "border-white/5 bg-white/[0.015]" : "border-white/5 bg-white/[0.03]"
    }`}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">{titulo}</h2>
        {acao && (
          <Link href={acao.href} className="text-[11px] text-sky-400 hover:underline">
            {acao.rotulo} →
          </Link>
        )}
        {futuro && (
          <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9.5px] uppercase tracking-wider text-slate-600">
            em construção
          </span>
        )}
      </div>
      <div className="mt-2 min-h-0 flex-1">{children}</div>
    </section>
  );
}

export default async function DecisionCenter() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/" titulo="Meu Patrimônio">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const desde45d = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const desde48h = new Date(Date.now() - 48 * 3_600_000).toISOString();

  const [
    { data: scoresRaw }, { data: tesesRaw }, { data: eventosRaw },
    { data: precosRaw }, { data: decisoesRaw }, radarLinhas,
  ] = await Promise.all([
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
    supabase
      .from("decisoes")
      .select("id, ticker, decisao, criado_em")
      .order("criado_em", { ascending: false })
      .limit(3),
    calcularRadar(supabase),
  ]);

  // Cenário macro (Focus/BCB) — guardado: sem a migração 012, vem null
  const { data: focusRaw } = await supabase
    .from("macro_focus")
    .select("indicador, data_pesquisa, ano_referencia, mediana")
    .eq("ano_referencia", new Date().getFullYear())
    .order("data_pesquisa", { ascending: false })
    .limit(40);
  const focus = (focusRaw as { indicador: string; data_pesquisa: string; ano_referencia: number; mediana: number }[] | null) ?? [];
  const focusPorInd = new Map<string, { atual: number; anterior: number | null; data: string }>();
  for (const f of focus) {
    const j = focusPorInd.get(f.indicador);
    if (!j) focusPorInd.set(f.indicador, { atual: Number(f.mediana), anterior: null, data: f.data_pesquisa });
    else if (j.anterior === null && f.data_pesquisa < j.data) j.anterior = Number(f.mediana);
  }

  // ---------- nota oficial mais recente por ticker ----------
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
  const emRevisao = ranking.filter((r) => statusPorTicker.get(r.ticker) === "em_revisao").length;

  // ---------- preços (série p/ sparkline + variação do dia) ----------
  const precosPorTicker = new Map<string, PrecoRow[]>();
  for (const p of (precosRaw as PrecoRow[]) ?? []) {
    const arr = precosPorTicker.get(p.ticker) ?? [];
    if (!arr.find((x) => x.data === p.data)) arr.push(p);
    precosPorTicker.set(p.ticker, arr);
  }

  // ---------- carteira (guardado: sem a migração 014, vem erro e fica null) ----------
  const { data: posicoesRaw, error: erroPosicoes } = await supabase
    .from("posicoes")
    .select("ticker, quantidade, preco_medio");
  const posicoes = erroPosicoes ? null : ((posicoesRaw as Posicao[]) ?? []);
  const ultimoPreco = new Map<string, number>();
  for (const [t, ps] of precosPorTicker) {
    if (ps[0]?.fechamento) ultimoPreco.set(t, Number(ps[0].fechamento));
  }
  const carteira =
    posicoes && posicoes.length > 0 ? consolidarCarteira(posicoes, ultimoPreco) : null;

  // ---------- Patrimônio (PIC 01): série real vs CDI/IPCA/Ibovespa ----------
  // Método e limitações documentados em src/lib/patrimonio.ts — resumo:
  // só entram posições com data de compra registrada; assume quantidade
  // constante desde essa data (sem ledger de trades parciais ainda).
  const patrimonio = await calcularPatrimonio(supabase);

  // ---------- Decision Feed (PIC 01): ação sugerida por posição, só regras ----------
  let decisionFeed: ReturnType<typeof gerarDecisionFeed> = [];
  if (carteira && carteira.linhas.length > 0) {
    const technicalLinhas = await calcularTechnicals(supabase);
    const technicalPorTicker = new Map(technicalLinhas.map((t) => [t.ticker, t.resultado]));
    const entradasFeed: DecisionFeedEntrada[] = carteira.linhas.map((l) => {
      const tec = technicalPorTicker.get(l.ticker);
      const timing = tec?.timing ?? null;
      const timingFavoravel =
        timing === "excelente" || timing === "bom"
          ? true
          : timing === "ruim" || timing === "muito_ruim"
          ? false
          : null;
      return {
        ticker: l.ticker,
        nome: l.ticker,
        statusTese: (statusPorTicker.get(l.ticker) as DecisionFeedEntrada["statusTese"]) ?? null,
        teseTecnica: tec?.teseTecnica ?? null,
        timingFavoravel,
        fraseTiming: tec?.fraseTiming ?? null,
      };
    });
    decisionFeed = gerarDecisionFeed(entradasFeed);
  }

  // ---------- hero: as respostas ----------
  const eventos = (eventosRaw as unknown as EventoRow[]) ?? [];
  const agora = Date.now();
  const ev24 = eventos.filter((e) => agora - new Date(e.criado_em).getTime() < 24 * 3_600_000);
  const gat24 = ev24.filter((e) => e.tipo === "gatilho_disparado").length;
  const mud24 = ev24.filter((e) => e.tipo === "mudanca_status").length;
  const precisaAgir = gat24 + mud24 > 0;

  const porData = new Map<string, number[]>();
  for (const s of (scoresRaw as unknown as ScoreRow[]) ?? []) {
    const arr = porData.get(s.data) ?? [];
    arr.push(s.score_final);
    porData.set(s.data, arr);
  }
  const datasScore = [...porData.keys()].sort().reverse();
  const media = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const notaMedia = datasScore[0] ? media(porData.get(datasScore[0])!) : null;
  const notaAnterior = datasScore[1] ? media(porData.get(datasScore[1])!) : null;
  const deltaNota = notaMedia !== null && notaAnterior !== null ? notaMedia - notaAnterior : null;
  const lider = ranking[0];
  const topCandidatas = candidatas(radarLinhas, 3);
  const decisoes = (decisoesRaw as DecisaoRow[]) ?? [];

  const horaSP = (new Date().getUTCHours() + 21) % 24;
  const saudacao = horaSP < 12 ? "Bom dia" : horaSP < 18 ? "Boa tarde" : "Boa noite";
  const hoje = new Date().toLocaleDateString("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", timeZone: "America/Sao_Paulo",
  });

  const frases: string[] = [];
  frases.push(
    precisaAgir
      ? `${gat24 > 0 ? `${gat24} gatilho${gat24 > 1 ? "s" : ""} disparou` : ""}${gat24 > 0 && mud24 > 0 ? " e " : ""}${mud24 > 0 ? `${mud24} tese${mud24 > 1 ? "s" : ""} mudou de status` : ""} nas últimas 24 horas — comece pelas mudanças do dia.`
      : "Nenhum gatilho disparou e nenhuma tese mudou nas últimas 24 horas. Nada exige sua ação agora."
  );
  if (emRevisao > 0) {
    frases.push(`${emRevisao} tese${emRevisao > 1 ? "s" : ""} em revisão pede${emRevisao > 1 ? "m" : ""} estudo.`);
  } else {
    frases.push("Suas 11 teses seguem de pé.");
  }
  if (topCandidatas.length > 0) {
    frases.push(
      `O Radar aponta ${topCandidatas.length} candidata${topCandidatas.length > 1 ? "s" : ""} a nova tese — a mais forte é ${topCandidatas[0].ticker} (${topCandidatas[0].nota}).`
    );
  }
  if (carteira && carteira.valorAtual !== null && carteira.resultadoPct !== null) {
    const sinal = carteira.resultadoPct >= 0 ? "+" : "−";
    frases.push(
      `Sua carteira vale ${carteira.valorAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} (${sinal}${Math.abs(carteira.resultadoPct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% sobre o investido).`
    );
  }

  return (
    <Shell ativo="/" titulo="Meu Patrimônio" subtitulo={hoje} rolagem>
      {/* ================= HERO — o copiloto ================= */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.04] px-6 py-5 backdrop-blur">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="min-w-0 max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-slate-100">
              {saudacao}, Carlos.
            </h2>
            <div className="mt-2 space-y-1">
              {frases.map((f, i) => (
                <p
                  key={i}
                  className={`text-[13.5px] leading-relaxed ${
                    i === 0 && precisaAgir ? "text-amber-200" : "text-slate-300"
                  }`}
                >
                  {f}
                </p>
              ))}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-6 text-right">
            <div>
              <p className="text-2xl font-bold text-slate-100">
                {notaMedia !== null ? notaMedia.toFixed(0) : "—"}
                {deltaNota !== null && deltaNota !== 0 && (
                  <span className={`ml-1 text-sm font-semibold ${deltaNota > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    {deltaNota > 0 ? "▲" : "▼"}{Math.abs(deltaNota).toFixed(1)}
                  </span>
                )}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">nota média</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${emRevisao > 0 ? "text-amber-300" : "text-slate-100"}`}>
                {emRevisao}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">em revisão</p>
            </div>
            {lider && (
              <div>
                <p className="text-2xl font-bold">
                  <Link href={`/tese/${lider.ticker}`} className="hover:underline">
                    <span className="font-mono text-slate-100">{lider.ticker}</span>{" "}
                    <span className="text-emerald-400">{lider.score_final}</span>
                  </Link>
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">tese mais forte</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= MEU PATRIMÔNIO (PIC 01) — o novo centro ================= */}
      {carteira && carteira.valorAtual !== null ? (
        <section className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.03] p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-emerald-300/80">Meu Patrimônio</h2>
            <Link href="/saude-carteira" className="text-[11px] text-sky-400 hover:underline">
              saúde da carteira →
            </Link>
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <p className="text-3xl font-bold text-slate-100">
                {carteira.valorAtual.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
              <p className="text-[10px] uppercase tracking-wider text-slate-500">patrimônio atual</p>
            </div>
            {carteira.resultadoPct !== null && (
              <div>
                <p className={`text-xl font-bold ${carteira.resultadoPct >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                  {carteira.resultadoPct >= 0 ? "+" : ""}
                  {(carteira.resultadoPct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                </p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500">sobre o preço médio</p>
              </div>
            )}
            {patrimonio && patrimonio.resultado.rentabilidadeTotal !== null && (
              <>
                <div>
                  <p className="text-xl font-bold text-slate-100">
                    {(patrimonio.resultado.rentabilidadeTotal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">rentabilidade desde a compra</p>
                </div>
                <div>
                  <p className={`text-xl font-bold ${
                    patrimonio.resultado.alpha.vsCdi === null
                      ? "text-slate-600"
                      : patrimonio.resultado.alpha.vsCdi >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}>
                    {patrimonio.resultado.alpha.vsCdi !== null
                      ? `${patrimonio.resultado.alpha.vsCdi >= 0 ? "+" : ""}${(patrimonio.resultado.alpha.vsCdi * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`
                      : "—"}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">alpha vs. CDI</p>
                </div>
                <div>
                  <p className={`text-xl font-bold ${
                    patrimonio.resultado.alpha.vsIbovespa === null
                      ? "text-slate-600"
                      : patrimonio.resultado.alpha.vsIbovespa >= 0
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}>
                    {patrimonio.resultado.alpha.vsIbovespa !== null
                      ? `${patrimonio.resultado.alpha.vsIbovespa >= 0 ? "+" : ""}${(patrimonio.resultado.alpha.vsIbovespa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} p.p.`
                      : "—"}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">alpha vs. Ibovespa</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-100">
                    {patrimonio.resultado.drawdownMaximo !== null
                      ? `${(patrimonio.resultado.drawdownMaximo * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                      : "—"}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">maior queda (drawdown)</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-100">
                    {patrimonio.resultado.sharpe !== null ? patrimonio.resultado.sharpe.toFixed(2) : "—"}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Sharpe (vs. CDI)</p>
                </div>
              </>
            )}
          </div>
          {(!patrimonio || patrimonio.resultado.rentabilidadeTotal === null) && (
            <p className="mt-3 text-[11.5px] leading-relaxed text-slate-500">
              Comparação com CDI/IPCA/Ibovespa e drawdown ainda indisponíveis
              {patrimonio && patrimonio.posicoesForaDaSerie.length > 0 ? (
                <>
                  {" "}
                  — falta a data de compra de{" "}
                  <span className="font-mono text-slate-400">{patrimonio.posicoesForaDaSerie.join(", ")}</span>. Nunca
                  estimamos essa data por você:{" "}
                  <Link href="/carteira" className="text-sky-400 hover:underline">registre em /carteira →</Link>
                </>
              ) : (
                "."
              )}
            </p>
          )}
          {patrimonio && patrimonio.resultado.sharpe === null && patrimonio.resultado.motivoSemSharpe && (
            <p className="mt-1 text-[10.5px] leading-snug text-slate-600">{patrimonio.resultado.motivoSemSharpe}</p>
          )}

          {decisionFeed.length > 0 && (
            <div className="mt-4 border-t border-white/5 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-slate-500">Ação recomendada por posição — nunca &quot;comprar&quot;/&quot;vender&quot;</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {decisionFeed.map((f) => (
                  <div
                    key={f.ticker}
                    title={f.explicacao}
                    className={`rounded-lg border px-2.5 py-1.5 text-[11.5px] ${SUGESTAO_COR[f.sugestao]}`}
                  >
                    <span className="font-mono font-semibold">{f.ticker}</span>{" "}
                    <span className="opacity-90">{ROTULO_SUGESTAO[f.sugestao]}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-white/5 bg-white/[0.015] p-5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Meu Patrimônio</h2>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9.5px] uppercase tracking-wider text-slate-600">
              em construção
            </span>
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
            {posicoes === null ? (
              <>O módulo está pronto; falta aplicar a migração 014 no banco.</>
            ) : (
              <>
                Registre suas posições reais (com data de compra) e este painel passa a mostrar patrimônio,
                rentabilidade e alpha contra CDI/IPCA/Ibovespa calculados sobre o que você DE FATO tem.{" "}
                <Link href="/carteira" className="text-sky-400 hover:underline">registrar posições →</Link>
              </>
            )}
          </p>
        </section>
      )}

      {/* ================= cenário macro (Focus) — acende com a 012 ================= */}
      {focusPorInd.size > 0 && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.03] px-5 py-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
              Cenário macro — Relatório Focus (BCB), expectativa p/ {new Date().getFullYear()}
            </h2>
            <p className="text-[10px] text-slate-600">macro informa; quem decide são as suas teses</p>
          </div>
          <div className="mt-2 flex flex-wrap gap-6">
            {["IPCA", "Selic", "PIB Total", "Câmbio"].map((ind) => {
              const f = focusPorInd.get(ind);
              if (!f) return null;
              const delta = f.anterior !== null ? f.atual - f.anterior : null;
              return (
                <div key={ind}>
                  <p className="text-base font-bold text-slate-100">
                    {f.atual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                    {ind === "Câmbio" ? "" : "%"}
                    {delta !== null && Math.abs(delta) >= 0.01 && (
                      <span className={`ml-1 text-[11px] font-semibold ${delta > 0 ? "text-amber-300" : "text-sky-300"}`}>
                        {delta > 0 ? "▲" : "▼"}{Math.abs(delta).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                      </span>
                    )}
                  </p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{ind}</p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ================= linha 1: mudanças + radar ================= */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Card titulo="Mudanças (48h)" acao={{ href: "/replay", rotulo: "replay completo" }}>
          {eventos.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nada mudou — dia tranquilo é o sistema dizendo: suas teses seguem de pé.
            </p>
          ) : (
            <div className="space-y-2.5 border-l border-white/10 pl-4">
              {eventos.slice(0, 6).map((e) => (
                <div key={e.id} className="relative">
                  <span className="absolute -left-[21.5px] top-1.5 h-2 w-2 rounded-full bg-sky-400/70" />
                  <p className="text-[10px] uppercase tracking-wider text-slate-600">
                    {fmtHora(e.criado_em)} ·{" "}
                    <Link href={`/tese/${e.teses?.ticker}`} className="font-mono text-sky-400/90 hover:underline">
                      {e.teses?.ticker}
                    </Link>{" "}
                    · {e.tipo.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-300">
                    {e.explicacao}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card titulo="Radar — merece sua atenção" acao={{ href: "/radar", rotulo: "ver as 40" }}>
          {topCandidatas.length === 0 ? (
            <p className="text-sm text-slate-500">Sem candidatas com dados suficientes hoje.</p>
          ) : (
            <div className="space-y-2">
              {topCandidatas.map((c) => (
                <div key={c.ticker} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-[13px]">
                      <span className="font-mono font-semibold">{c.ticker}</span>
                      <span className="ml-2 text-slate-400">{c.nome}</span>
                    </p>
                    <p className="text-[10.5px] text-slate-500">
                      {c.caixaLiquido ? "caixa líquido" : "com dívida"} ·{" "}
                      {c.pl !== null ? `preço/lucro ${c.pl.toFixed(1)}×` : "P/L —"} · confiança {c.confianca}
                    </p>
                  </div>
                  <span className={`text-lg font-bold ${corNota(c.nota)}`}>{c.nota}</span>
                </div>
              ))}
              <p className="text-[10px] text-slate-600">
                candidatas a ESTUDO — prévia pelas réguas v1, nunca ordem de compra
              </p>
            </div>
          )}
        </Card>
      </div>

      {/* ================= linha 2: universo por nota ================= */}
      <Card titulo="Universo por nota (oficial)" acao={{ href: "/ranking", rotulo: "ranking" }}>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
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
                      varDia === null ? "text-slate-600" : varDia >= 0 ? "text-emerald-400" : "text-red-400"
                    }`}>
                      {varDia === null
                        ? "—"
                        : `${varDia >= 0 ? "+" : ""}${(varDia * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                    </td>
                    <td className="py-2 pr-2 text-right">
                      <Sparkline valores={[...ps].reverse().map((p) => Number(p.fechamento))} />
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
                    Sem notas ainda — o motor roda todo dia útil às 20h30.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ================= linha 3: diário + placeholders honestos ================= */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Card titulo="Suas últimas decisões" acao={{ href: "/diario", rotulo: "diário" }}>
          {decisoes.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma decisão registrada ainda.</p>
          ) : (
            <div className="space-y-2">
              {decisoes.map((d) => (
                <div key={d.id} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[12.5px]">
                  <span>
                    <span className="font-mono font-semibold">{d.ticker}</span>
                    <span className="ml-2 text-slate-400">{DECISAO_TXT[d.decisao] ?? d.decisao}</span>
                  </span>
                  <span className="text-[10px] text-slate-600">{fmtHora(d.criado_em)}</span>
                </div>
              ))}
              <p className="text-[10px] text-slate-600">
                registro imutável — é este diário que mede se o sistema melhora suas decisões
              </p>
            </div>
          )}
        </Card>

        {carteira ? (
          <Card titulo="Sua carteira" acao={{ href: "/carteira", rotulo: "carteira" }}>
            <div className="space-y-2">
              {carteira.linhas.slice(0, 3).map((l) => (
                <div key={l.ticker} className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-3 py-2 text-[12.5px]">
                  <span className="font-mono font-semibold">{l.ticker}</span>
                  <span className={`font-mono ${
                    l.resultadoPct === null ? "text-slate-600" : l.resultadoPct >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}>
                    {l.resultadoPct === null
                      ? "—"
                      : `${l.resultadoPct >= 0 ? "+" : ""}${(l.resultadoPct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`}
                  </span>
                </div>
              ))}
              <p className="text-[10px] text-slate-600">
                {carteira.linhas.length} posiç{carteira.linhas.length > 1 ? "ões" : "ão"} ·
                resultado sobre o SEU preço médio — nunca recomendação
              </p>
            </div>
          </Card>
        ) : (
          <Card titulo="Sua carteira" futuro>
            <p className="text-[12px] leading-relaxed text-slate-500">
              {posicoes === null ? (
                <>O módulo está pronto; falta aplicar a migração 014 no banco.</>
              ) : (
                <>
                  Registre suas posições reais (quantidade e preço médio) e este
                  card passa a mostrar patrimônio e resultado calculados sobre o
                  que você DE FATO tem.{" "}
                  <Link href="/carteira" className="text-sky-400 hover:underline">registrar posições →</Link>
                </>
              )}
            </p>
          </Card>
        )}

        <Card titulo="Calendário & IA explicativa" futuro>
          <p className="text-[12px] leading-relaxed text-slate-500">
            Agenda de resultados, dividendos e Copom ainda{" "}
            <span className="text-slate-300">não tem fonte de dados conectada</span> — entra na
            expansão. A IA explicativa (nunca decisória) entra ao configurar a chave da API; as
            explicações de hoje são geradas por regras.{" "}
            <Link href="/em-breve?m=ia" className="text-sky-400 hover:underline">saiba mais →</Link>
          </p>
        </Card>
      </div>
    </Shell>
  );
}
