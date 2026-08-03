import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { Sparkline } from "@/components/Sparkline";
import { GraficoPatrimonio } from "@/components/GraficoPatrimonio";
import { calcularRadar, candidatas } from "@/lib/radar";
import { consolidarCarteira, type Posicao } from "@/lib/carteira";
import { calcularPatrimonio } from "@/lib/patrimonio-dados";
import { calcularTechnicals } from "@/lib/technical-dados";
import { calcularConfluencias } from "@/lib/confluencia-dados";
import { confluenciaMediaPonderada } from "@/lib/portfolio-health";
import { gerarDecisionFeed, ROTULO_SUGESTAO, type DecisionFeedEntrada, type SugestaoFeed } from "@/lib/decision-feed";

export const dynamic = "force-dynamic";

/**
 * MEU DASH (redesign "glass" premium, 03/08/2026; renomeado de "Meu
 * Patrimônio" para "Meu Dash" no mesmo dia) — hierarquia fixa pedida pelo
 * Carlos, nunca ao contrário:
 *   01 Meu Patrimônio · 02 Performance · 03 Minha Carteira ·
 *   04 Oportunidades · 05 Alertas · 06 IA · 07 Empresas
 * (o TÍTULO da página/aba é "Meu Dash"; a seção 01 continua se chamando
 * "Meu Patrimônio" internamente — é o número que ela mostra, não o rótulo
 * do produto).
 *
 * Regra inegociável: todo número renderizado vem de uma variável calculada
 * a partir de dado real (banco/regras puras) — nunca um valor decorativo.
 * Onde a métrica pedida não existe ainda de forma honesta (ex.: deltas
 * diários de Carry/Confluence — dependem de um snapshot diário que ainda
 * não existe), o card explica o motivo em vez de inventar um número ou uma
 * seta. Todo o conteúdo que já existia (Mudanças, Radar, Universo por nota,
 * Diário, Carteira, cenário macro) continua aqui — só reorganizado.
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
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pctSinal = (v: number, casas = 1) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;

/** Seção numerada de topo — reforça visualmente a hierarquia fixa 01→07. */
function Secao({
  numero, titulo, subtitulo, acao, children,
}: {
  numero: string; titulo: string; subtitulo?: string;
  acao?: { href: string; rotulo: string }; children: React.ReactNode;
}) {
  return (
    <section className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 text-[10px] font-semibold text-slate-500">
            {numero}
          </span>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">{titulo}</h2>
        </div>
        {acao && (
          <Link href={acao.href} className="text-[11px] text-sky-400 hover:underline">
            {acao.rotulo} →
          </Link>
        )}
      </div>
      {subtitulo && <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-slate-500">{subtitulo}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Painel interno (dentro de uma Seção) — mesmo visual das páginas internas. */
function Painel({
  titulo, acao, children, futuro,
}: {
  titulo: string; acao?: { href: string; rotulo: string };
  children: React.ReactNode; futuro?: boolean;
}) {
  return (
    <section className={`flex flex-col rounded-[18px] border p-4 ${
      futuro ? "border-white/5 bg-white/[0.012]" : "border-white/5 bg-white/[0.025]"
    }`}>
      <div className="flex items-baseline justify-between">
        <h3 className="text-[10.5px] uppercase tracking-[0.22em] text-slate-500">{titulo}</h3>
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

/** Estatística tipo "stat tile" — número grande + rótulo, com corte honesto embutido. */
function Stat({
  rotulo, valor, cor = "text-slate-100", nota,
}: { rotulo: string; valor: string; cor?: string; nota?: string }) {
  return (
    <div>
      <p className={`font-mono text-xl font-bold ${cor}`}>{valor}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{rotulo}</p>
      {nota && <p className="mt-0.5 text-[9.5px] leading-snug text-slate-600">{nota}</p>}
    </div>
  );
}

export default async function DecisionCenter() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/" titulo="Meu Dash">
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

  // ---------- Patrimônio: série real vs CDI/IPCA/Ibovespa ----------
  // Método e limitações documentados em src/lib/patrimonio.ts — resumo:
  // só entram posições com data de compra registrada; assume quantidade
  // constante desde essa data (sem ledger de trades parciais ainda).
  const patrimonio = await calcularPatrimonio(supabase);

  // ---------- Decision Feed + Confluence da carteira ----------
  let decisionFeed: ReturnType<typeof gerarDecisionFeed> = [];
  let confluenciaCarteira: ReturnType<typeof confluenciaMediaPonderada> | null = null;
  if (carteira && carteira.linhas.length > 0) {
    const [technicalLinhas, confluenciaLinhas] = await Promise.all([
      calcularTechnicals(supabase),
      calcularConfluencias(supabase),
    ]);
    const technicalPorTicker = new Map(technicalLinhas.map((t) => [t.ticker, t.resultado]));
    const confluenciaPorTicker = new Map(confluenciaLinhas.map((c) => [c.ticker, c.resultado.score]));
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
    // Confluence Score médio da carteira — ponderado pelo peso de cada
    // posição no valor atual, só entram tickers com score calculável.
    confluenciaCarteira = confluenciaMediaPonderada(
      carteira.linhas.map((l) => ({ peso: l.peso ?? 0, score: confluenciaPorTicker.get(l.ticker) ?? null }))
    );
  }

  // ---------- hero / eventos ----------
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
  } else if (ranking.length > 0) {
    frases.push(`Suas ${ranking.length} teses acompanhadas seguem de pé.`);
  }
  if (topCandidatas.length > 0) {
    frases.push(
      `O Radar aponta ${topCandidatas.length} candidata${topCandidatas.length > 1 ? "s" : ""} a nova tese — a mais forte é ${topCandidatas[0].ticker} (${topCandidatas[0].nota}).`
    );
  }
  if (carteira && carteira.valorAtual !== null && carteira.resultadoPct !== null) {
    const sinal = carteira.resultadoPct >= 0 ? "+" : "−";
    frases.push(
      `Sua carteira vale ${brl(carteira.valorAtual)} (${sinal}${Math.abs(carteira.resultadoPct * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% sobre o investido).`
    );
  }
  if (patrimonio && patrimonio.resultado.alpha.vsCdi !== null) {
    const alpha = patrimonio.resultado.alpha.vsCdi;
    frases.push(
      alpha >= 0
        ? `Desde a compra, a carteira supera o CDI em ${pctSinal(alpha)} — Alpha positivo.`
        : `Desde a compra, a carteira está ${pctSinal(alpha)} (abaixo do CDI no período).`
    );
  }

  const corAlpha = (v: number | null) =>
    v === null ? "text-slate-600" : v >= 0 ? "text-emerald-400" : "text-red-400";

  return (
    <Shell ativo="/" titulo="Meu Dash" subtitulo={hoje} rolagem>
      {/* ================= ambiente: cenário macro (Focus) — sempre discreto, nunca compete com a hierarquia ================= */}
      {focusPorInd.size > 0 && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 rounded-full border border-white/[0.05] bg-white/[0.015] px-5 py-2 text-[11px]">
          <span className="text-slate-600">Cenário macro (Focus/BCB, {new Date().getFullYear()})</span>
          {["IPCA", "Selic", "PIB Total", "Câmbio"].map((ind) => {
            const f = focusPorInd.get(ind);
            if (!f) return null;
            const delta = f.anterior !== null ? f.atual - f.anterior : null;
            return (
              <span key={ind} className="text-slate-400">
                {ind}{" "}
                <span className="font-mono text-slate-200">
                  {f.atual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                  {ind === "Câmbio" ? "" : "%"}
                </span>
                {delta !== null && Math.abs(delta) >= 0.01 && (
                  <span className={`ml-1 ${delta > 0 ? "text-amber-300" : "text-sky-300"}`}>
                    {delta > 0 ? "▲" : "▼"}
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}

      {/* ================= 01 — MEU PATRIMÔNIO ================= */}
      <Secao numero="01" titulo="Meu Patrimônio">
        {carteira && carteira.valorAtual !== null ? (
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-[44px] font-semibold leading-none tracking-tight text-slate-100">
                {brl(carteira.valorAtual)}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {carteira.resultadoPct !== null && (
                  <span
                    className={`rounded-full border px-2.5 py-1 text-[12.5px] font-semibold ${
                      carteira.resultadoPct >= 0
                        ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300"
                        : "border-red-400/25 bg-red-500/10 text-red-300"
                    }`}
                  >
                    {pctSinal(carteira.resultadoPct)} sobre o preço médio
                  </span>
                )}
                {patrimonio && patrimonio.resultado.rentabilidadeTotal !== null && (
                  <span className="text-[12.5px] text-slate-500">
                    {pctSinal(patrimonio.resultado.rentabilidadeTotal)} desde a data de compra registrada
                  </span>
                )}
              </div>
            </div>
            <p className="max-w-xs text-right text-[11px] leading-relaxed text-slate-500">
              {carteira.linhas.length} posiç{carteira.linhas.length > 1 ? "ões" : "ão"} reais registradas · preço
              oficial mais recente · nunca recomendação
            </p>
          </div>
        ) : (
          <div>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9.5px] uppercase tracking-wider text-slate-600">
              em construção
            </span>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
              {posicoes === null ? (
                <>O módulo está pronto; falta aplicar a migração 014 no banco.</>
              ) : (
                <>
                  Registre suas posições reais (quantidade, preço médio e — se quiser habilitar Performance —
                  a data de compra) e este painel passa a mostrar o patrimônio calculado sobre o que você DE
                  FATO tem.{" "}
                  <Link href="/carteira" className="text-sky-400 hover:underline">registrar posições →</Link>
                </>
              )}
            </p>
          </div>
        )}
      </Secao>

      {/* ================= 02 — PERFORMANCE ================= */}
      <Secao
        numero="02"
        titulo="Performance"
        subtitulo="Carteira real vs. CDI, Ibovespa e IPCA — mesma simulação de aporte para os quatro, comparável em R$."
        acao={carteira ? { href: "/carteira", rotulo: "saúde da carteira" } : undefined}
      >
        {patrimonio && patrimonio.resultado.pontos.length >= 2 ? (
          <>
            <GraficoPatrimonio pontos={patrimonio.resultado.pontos} />
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-white/5 pt-4 sm:grid-cols-3 lg:grid-cols-6">
              <Stat
                rotulo="Alpha vs. CDI"
                valor={patrimonio.resultado.alpha.vsCdi !== null ? pctSinal(patrimonio.resultado.alpha.vsCdi) : "—"}
                cor={corAlpha(patrimonio.resultado.alpha.vsCdi)}
              />
              <Stat
                rotulo="Alpha vs. IPCA"
                valor={patrimonio.resultado.alpha.vsIpca !== null ? pctSinal(patrimonio.resultado.alpha.vsIpca) : "—"}
                cor={corAlpha(patrimonio.resultado.alpha.vsIpca)}
              />
              <Stat
                rotulo="Alpha vs. Ibovespa"
                valor={patrimonio.resultado.alpha.vsIbovespa !== null ? pctSinal(patrimonio.resultado.alpha.vsIbovespa) : "—"}
                cor={corAlpha(patrimonio.resultado.alpha.vsIbovespa)}
              />
              <Stat
                rotulo="Maior queda (drawdown)"
                valor={patrimonio.resultado.drawdownMaximo !== null ? pctSinal(patrimonio.resultado.drawdownMaximo) : "—"}
              />
              <Stat
                rotulo="Sharpe (vs. CDI)"
                valor={patrimonio.resultado.sharpe !== null ? patrimonio.resultado.sharpe.toFixed(2) : "—"}
              />
              <Stat
                rotulo="Sortino (downside vs. CDI)"
                valor={patrimonio.resultado.sortino !== null ? patrimonio.resultado.sortino.toFixed(2) : "—"}
              />
              <Stat
                rotulo="Volatilidade anualizada"
                valor={
                  patrimonio.resultado.volatilidadeAnualizada !== null
                    ? `${(patrimonio.resultado.volatilidadeAnualizada * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                    : "—"
                }
              />
            </div>
            {patrimonio.resultado.motivoSemSharpe && (
              <p className="mt-3 text-[10.5px] leading-snug text-slate-600">{patrimonio.resultado.motivoSemSharpe}</p>
            )}
          </>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-slate-500">
            {!patrimonio || patrimonio.posicoesForaDaSerie.length === 0 ? (
              <>
                Ainda não há série suficiente (2+ pregões) desde a data de compra para desenhar o gráfico e comparar
                com CDI/IPCA/Ibovespa.
              </>
            ) : (
              <>
                Comparação com CDI/IPCA/Ibovespa ainda indisponível — falta a data de compra de{" "}
                <span className="font-mono text-slate-400">{patrimonio.posicoesForaDaSerie.join(", ")}</span>. Nunca
                estimamos essa data por você:{" "}
                <Link href="/carteira" className="text-sky-400 hover:underline">registre em /carteira →</Link>
              </>
            )}
          </p>
        )}
      </Secao>

      {/* ================= 03 — MINHA CARTEIRA ================= */}
      <Secao numero="03" titulo="Minha Carteira" acao={{ href: "/carteira", rotulo: "carteira completa" }}>
        {carteira ? (
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
            <Painel titulo="Resumo">
              <div className="grid grid-cols-2 gap-4">
                <Stat rotulo="Investido" valor={brl(carteira.valorInvestido)} />
                <Stat
                  rotulo="Resultado"
                  valor={carteira.resultado !== null ? brl(carteira.resultado) : "—"}
                  cor={carteira.resultado === null ? "text-slate-600" : carteira.resultado >= 0 ? "text-emerald-400" : "text-red-400"}
                />
                <Stat
                  rotulo="Confluence médio"
                  valor={
                    confluenciaCarteira && confluenciaCarteira.valor !== null
                      ? Math.round(confluenciaCarteira.valor).toString()
                      : "—"
                  }
                  cor={confluenciaCarteira && confluenciaCarteira.valor !== null ? "text-sky-300" : "text-slate-600"}
                  nota={
                    confluenciaCarteira
                      ? `cobertura ${confluenciaCarteira.cobertura}/${confluenciaCarteira.total} posições`
                      : undefined
                  }
                />
                <Stat rotulo="Posições" valor={String(carteira.linhas.length)} />
              </div>
            </Painel>

            <Painel titulo="Ação sugerida por posição">
              {decisionFeed.length === 0 ? (
                <p className="text-[12px] text-slate-500">
                  Sem dado técnico suficiente ainda para sugerir prioridade por posição.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
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
              )}
              <p className="mt-2 text-[10px] text-slate-600">100% por regras explícitas — nunca &quot;comprar&quot;/&quot;vender&quot;</p>
            </Painel>

            <Painel titulo="Suas últimas decisões" acao={{ href: "/diario", rotulo: "diário" }}>
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
                  <p className="text-[10px] text-slate-600">registro imutável do Diário</p>
                </div>
              )}
            </Painel>
          </div>
        ) : (
          <div>
            <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9.5px] uppercase tracking-wider text-slate-600">
              em construção
            </span>
            <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
              {posicoes === null ? (
                <>O módulo está pronto; falta aplicar a migração 014 no banco.</>
              ) : (
                <>
                  Registre suas posições reais (quantidade e preço médio) e este bloco passa a mostrar resumo,
                  Confluence e ação sugerida por posição.{" "}
                  <Link href="/carteira" className="text-sky-400 hover:underline">registrar posições →</Link>
                </>
              )}
            </p>
          </div>
        )}
      </Secao>

      {/* ================= 04 — OPORTUNIDADES ================= */}
      <Secao
        numero="04"
        titulo="Oportunidades"
        subtitulo="Candidatas a ESTUDO pelas réguas v1 — prévia calculada na hora, nunca ordem de compra."
        acao={{ href: "/radar", rotulo: "ver as 40" }}
      >
        {topCandidatas.length === 0 ? (
          <p className="text-sm text-slate-500">Sem candidatas com dados suficientes hoje.</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
            {topCandidatas.map((c) => {
              const ps = precosPorTicker.get(c.ticker) ?? [];
              return (
                <Link
                  key={c.ticker}
                  href={`/tese/${c.ticker}`}
                  className="flex flex-col gap-2 rounded-[16px] border border-white/5 bg-white/[0.02] px-3.5 py-3 transition-colors hover:bg-white/[0.04]"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <p className="text-[13.5px]">
                        <span className="font-mono font-semibold">{c.ticker}</span>
                      </p>
                      <p className="truncate text-[11px] text-slate-500">{c.nome}</p>
                    </div>
                    <span className={`text-xl font-bold ${corNota(c.nota)}`}>{c.nota}</span>
                  </div>
                  <Sparkline valores={[...ps].reverse().map((p) => Number(p.fechamento))} />
                  <p className="text-[10.5px] text-slate-500">
                    {c.caixaLiquido ? "caixa líquido" : "com dívida"} ·{" "}
                    {c.pl !== null ? `preço/lucro ${c.pl.toFixed(1)}×` : "P/L —"} · confiança {c.confianca}
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </Secao>

      {/* ================= 05 — ALERTAS ================= */}
      <Secao numero="05" titulo="Alertas" acao={{ href: "/replay", rotulo: "replay completo" }}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="flex gap-6 lg:col-span-1 lg:flex-col lg:gap-4">
            <Stat
              rotulo="Gatilhos (24h)"
              valor={String(gat24)}
              cor={gat24 > 0 ? "text-amber-300" : "text-slate-100"}
            />
            <Stat
              rotulo="Mudanças de status (24h)"
              valor={String(mud24)}
              cor={mud24 > 0 ? "text-amber-300" : "text-slate-100"}
            />
            <Stat
              rotulo="Teses em revisão"
              valor={String(emRevisao)}
              cor={emRevisao > 0 ? "text-amber-300" : "text-slate-100"}
            />
            <Stat
              rotulo="Nota média (dia)"
              valor={notaMedia !== null ? notaMedia.toFixed(0) : "—"}
              cor={deltaNota !== null && deltaNota !== 0 ? (deltaNota > 0 ? "text-emerald-400" : "text-red-400") : "text-slate-100"}
              nota={deltaNota !== null && deltaNota !== 0 ? `${deltaNota > 0 ? "▲" : "▼"} ${Math.abs(deltaNota).toFixed(1)} desde o pregão anterior` : undefined}
            />
          </div>
          <div className="lg:col-span-2">
            {eventos.length === 0 ? (
              <p className="text-sm text-slate-500">
                Nada mudou nas últimas 48h — dia tranquilo é o sistema dizendo: suas teses seguem de pé.
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
                    <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-slate-300">{e.explicacao}</p>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[10px] leading-snug text-slate-600">
              Deltas diários de Carry médio, Confluence e Technical Score da carteira ainda não têm histórico dia a
              dia para comparar — o snapshot começa a acumular hoje à noite (rodada das 20h30). Até lá, mostramos só
              o que já é honestamente comparável: gatilhos, mudanças de status e nota média.
            </p>
          </div>
        </div>
      </Secao>

      {/* ================= 06 — IA (resumo por regras) ================= */}
      <Secao
        numero="06"
        titulo="IA"
        subtitulo="Nunca decide — só explica em português o que as regras já calcularam. Nenhuma frase abaixo vem de um modelo de linguagem: é texto gerado por condição (se X e Y, escreve Z)."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <div className="rounded-[16px] border border-white/5 bg-white/[0.02] p-4">
            <p className="text-[15px] font-semibold text-slate-100">{saudacao}, Carlos.</p>
            <div className="mt-2 space-y-1.5">
              {frases.map((f, i) => (
                <p
                  key={i}
                  className={`text-[13px] leading-relaxed ${i === 0 && precisaAgir ? "text-amber-200" : "text-slate-300"}`}
                >
                  {f}
                </p>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-4 border-t border-white/5 pt-3">
              <Stat rotulo="Nota média" valor={notaMedia !== null ? notaMedia.toFixed(0) : "—"} />
              <Stat rotulo="Em revisão" valor={String(emRevisao)} cor={emRevisao > 0 ? "text-amber-300" : "text-slate-100"} />
              {lider && (
                <div>
                  <p className="text-xl font-bold">
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

          <Painel titulo="Calendário & IA explicativa" futuro>
            <p className="text-[12px] leading-relaxed text-slate-500">
              Agenda de resultados, dividendos e Copom ainda{" "}
              <span className="text-slate-300">não tem fonte de dados conectada</span> — entra na expansão. A IA
              explicativa por LLM (nunca decisória) entra ao configurar a chave da API; as explicações de hoje já
              são 100% geradas por regras, como as desta seção.{" "}
              <Link href="/em-breve?m=ia" className="text-sky-400 hover:underline">saiba mais →</Link>
            </p>
          </Painel>
        </div>
      </Secao>

      {/* ================= 07 — EMPRESAS (universo por nota) ================= */}
      <Secao numero="07" titulo="Empresas · Universo por nota (oficial)" acao={{ href: "/ranking", rotulo: "ranking" }}>
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
      </Secao>
    </Shell>
  );
}
