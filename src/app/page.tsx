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
import { calcularCompounders } from "@/lib/compounder-dados";
import {
  calcularSaudeCarteira,
  confluenciaMediaPonderada,
  montarLinhasSaude,
} from "@/lib/portfolio-health";
import { gerarDecisionFeed, ROTULO_SUGESTAO, type DecisionFeedEntrada, type SugestaoFeed } from "@/lib/decision-feed";
import type { Conviccao, ConfluenciaResultado } from "@/lib/confluencia";
import { ROTULO_SENSIBILIDADE } from "@/lib/compounder/sensibilidade-juros";
import { corHeatmapRetorno } from "@/lib/heatmap";

export const dynamic = "force-dynamic";

/**
 * MEU DASH — reconstrução "terminal financeiro" (03/08/2026, a pedido
 * explícito do Carlos: não é ajuste de CSS, é nova arquitetura da
 * informação). A hierarquia numérica 01→07 anterior foi substituída por 4
 * linhas de densidade decrescente:
 *
 *   LINHA 1 — 10 stat cards compactos (≤90px), TODOS numa única linha em
 *             telas largas (xl:grid-cols-10): Patrimônio, Investido,
 *             Resultado, Alpha, Carry, Confluence, Sharpe, Drawdown, Caixa,
 *             Posições.
 *   LINHA 2 — gráfico "Performance" (70% da largura, ~280-320px de altura
 *             — ver nota em GraficoPatrimonio.tsx sobre o novo aspect
 *             ratio) + coluna lateral (30%) com Resumo IA, Alertas, Radar
 *             e Oportunidades, cada painel esticado (`flex-1`) para nunca
 *             sobrar vazio ao lado do gráfico.
 *   LINHA 3 — Minha Carteira resumida (~65%) + Saúde da Carteira resumida
 *             (~35%), ambas com link "ver completo →" para /carteira.
 *   LINHA 4 — Timeline (mudanças 48h) · Decision Feed + Diário · Cenário
 *             Macro (Focus/BCB) · Heatmap de retorno por posição — as
 *             quatro ocupando a largura inteira.
 *   ABAIXO  — Universo por nota (ranking completo) — não cabe na primeira
 *             dobra, fica disponível com rolagem (ver Shell rolagem).
 *
 * Regra inegociável (mantida do redesign anterior): todo número renderizado
 * vem de uma variável calculada a partir de dado real — nunca um valor
 * decorativo. "Caixa" não tem motor de rastreamento de dinheiro não
 * investido no sistema hoje — mostra "—" com o motivo, nunca um saldo
 * inventado. Nenhuma funcionalidade que já existia (Decision Feed, Radar,
 * Universo por nota, Diário, cenário macro, Mudanças 48h) foi removida —
 * só redistribuída na nova densidade. O único bloco propositalmente
 * descartado é o antigo placeholder "Calendário & IA explicativa": era só
 * um "em construção" sem dado nenhum atrás, e continua acessível pelo menu
 * lateral ("Em construção" → IA explicativa).
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
const ROTULO_CONCENTRACAO: Record<string, string> = {
  baixa: "Baixa", moderada: "Moderada", alta: "Alta", muito_alta: "Muito alta",
};
const COR_CONCENTRACAO: Record<string, string> = {
  baixa: "text-emerald-300", moderada: "text-sky-300", alta: "text-amber-300", muito_alta: "text-red-300",
};
const COR_CONVICCAO: Record<Conviccao, string> = {
  alta: "text-emerald-300", moderada: "text-sky-300", baixa: "text-amber-300", indefinida: "text-slate-500",
};
const CHIP_CONVICCAO: Record<Conviccao, string> = {
  alta: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  moderada: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  baixa: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  indefinida: "text-slate-500 bg-white/[0.03] border-white/10",
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
/** Versão compacta da moeda pros stat cards de 84px de altura ("R$ 45,2 mil") — mesmo valor, só notação menor. */
const brlCompacto = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const pctSinal = (v: number, casas = 1) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
const pct = (v: number | null, casas = 1) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
const corAlpha = (v: number | null) =>
  v === null ? "text-slate-600" : v >= 0 ? "text-emerald-400" : "text-red-400";
const corResultado = (v: number | null) =>
  v === null ? "text-slate-500" : v >= 0 ? "text-emerald-300" : "text-red-300";

/** Card compacto da Linha 1 — altura fixa (84px, dentro do teto de 90px pedido), corte honesto embutido via "—". */
function MiniStat({
  rotulo, valor, cor = "text-slate-100", nota, titulo,
}: { rotulo: string; valor: string; cor?: string; nota?: string; titulo?: string }) {
  return (
    <div
      title={titulo}
      className="flex h-[84px] flex-col justify-between overflow-hidden rounded-[10px] border border-white/[0.06] bg-white/[0.03] px-2.5 py-2"
    >
      <p className="truncate text-[8px] font-semibold uppercase leading-tight tracking-wider text-slate-500">
        {rotulo}
      </p>
      <p className={`truncate font-mono text-[16px] font-bold leading-none ${cor}`}>{valor}</p>
      {nota && <p className="truncate text-[8px] leading-tight text-slate-600">{nota}</p>}
    </div>
  );
}

/** Painel compacto genérico — cabeçalho pequeno + link opcional, usado nas Linhas 2/3/4. */
function Bloco({
  titulo, acao, children, className = "",
}: { titulo: string; acao?: { href: string; rotulo: string }; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-[16px] border border-white/[0.06] bg-white/[0.03] p-3.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{titulo}</h2>
        {acao && (
          <Link href={acao.href} className="shrink-0 text-[10.5px] text-sky-400 hover:underline">
            {acao.rotulo} →
          </Link>
        )}
      </div>
      <div className="mt-2 min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** Stat pequena reusada dentro de Blocos (Saúde da Carteira, Macro) — sem altura fixa, grid 2 colunas. */
function StatMini({
  rotulo, valor, cor = "text-slate-100", nota,
}: { rotulo: string; valor: string; cor?: string; nota?: string }) {
  return (
    <div>
      <p className="truncate text-[8.5px] uppercase tracking-wider text-slate-500">{rotulo}</p>
      <p className={`truncate font-mono text-[13px] font-bold ${cor}`}>{valor}</p>
      {nota && <p className="truncate text-[8.5px] leading-snug text-slate-600">{nota}</p>}
    </div>
  );
}

/** Trio de números pequenos (gatilhos/mudanças/em revisão) — Linha 2, painel Alertas. */
function MiniNum({ rotulo, valor, alerta }: { rotulo: string; valor: number; alerta?: boolean }) {
  return (
    <div>
      <p className={`font-mono text-[16px] font-bold leading-none ${alerta ? "text-amber-300" : "text-slate-100"}`}>
        {valor}
      </p>
      <p className="mt-0.5 text-[7.5px] uppercase leading-tight tracking-wider text-slate-500">{rotulo}</p>
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
  const notaPorTicker = new Map<string, number>(ranking.map((r) => [r.ticker, r.score_final]));
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
  // Método e limitações documentados em src/lib/patrimonio.ts.
  const patrimonio = await calcularPatrimonio(supabase);

  // ---------- Decision Feed + Confluence/Saúde da carteira ----------
  let decisionFeed: ReturnType<typeof gerarDecisionFeed> = [];
  let confluenciaCarteira: ReturnType<typeof confluenciaMediaPonderada> | null = null;
  let confluenciaPorTicker = new Map<string, ConfluenciaResultado>();
  let saude: ReturnType<typeof calcularSaudeCarteira> | null = null;
  if (carteira && carteira.linhas.length > 0) {
    const [technicalLinhas, confluenciaLinhas, compounderLinhas] = await Promise.all([
      calcularTechnicals(supabase),
      calcularConfluencias(supabase),
      calcularCompounders(supabase),
    ]);
    const technicalPorTicker = new Map(technicalLinhas.map((t) => [t.ticker, t.resultado]));
    confluenciaPorTicker = new Map(confluenciaLinhas.map((c) => [c.ticker, c.resultado]));
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
      carteira.linhas.map((l) => ({ peso: l.peso ?? 0, score: confluenciaPorTicker.get(l.ticker)?.score ?? null }))
    );
    // Saúde da Carteira (Carry médio, Concentração, ROIC, Valuation,
    // Sensibilidade à Selic) — assembly compartilhado com /carteira, ver
    // montarLinhasSaude em src/lib/portfolio-health.ts.
    const linhasSaude = montarLinhasSaude(carteira.linhas, radarLinhas, compounderLinhas);
    saude = linhasSaude.length > 0 ? calcularSaudeCarteira(linhasSaude) : null;
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

  // valores prontos pros 10 cards da Linha 1 — cada um já é uma variável
  // calculada de dado real; onde falta dado, "—" com o motivo (nunca
  // decorativo). "Caixa": o sistema não tem ledger de dinheiro não
  // investido, só posições em ações — corte honesto explícito.
  const posicoesTxt = posicoes === null ? "—" : String(carteira ? carteira.linhas.length : 0);

  return (
    <Shell ativo="/" titulo="Meu Dash" subtitulo={hoje} rolagem>
      {/* ================= LINHA 1 — 10 cards compactos, ≤90px, uma única linha em telas largas ================= */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 xl:grid-cols-10">
        <MiniStat
          rotulo="Patrimônio"
          valor={carteira && carteira.valorAtual !== null ? brlCompacto(carteira.valorAtual) : "—"}
          titulo={carteira && carteira.valorAtual !== null ? brl(carteira.valorAtual) : "Sem posições com preço atual"}
        />
        <MiniStat
          rotulo="Investido"
          valor={carteira ? brlCompacto(carteira.valorInvestido) : "—"}
          titulo={carteira ? brl(carteira.valorInvestido) : "Sem posições registradas"}
        />
        <MiniStat
          rotulo="Resultado"
          valor={carteira && carteira.resultado !== null ? brlCompacto(carteira.resultado) : "—"}
          cor={carteira && carteira.resultado !== null ? corResultado(carteira.resultado) : "text-slate-600"}
          nota={carteira && carteira.resultadoPct !== null ? pctSinal(carteira.resultadoPct) : undefined}
          titulo={carteira && carteira.resultado !== null ? brl(carteira.resultado) : "Sem preço atual de alguma posição"}
        />
        <MiniStat
          rotulo="Alpha vs. CDI"
          valor={patrimonio && patrimonio.resultado.alpha.vsCdi !== null ? pctSinal(patrimonio.resultado.alpha.vsCdi) : "—"}
          cor={patrimonio ? corAlpha(patrimonio.resultado.alpha.vsCdi) : "text-slate-600"}
          titulo="Desde a data de compra registrada, vs. CDI simulado"
        />
        <MiniStat
          rotulo="Carry médio"
          valor={saude && saude.carryMedioPonderado !== null ? `IPCA+${(saude.carryMedioPonderado * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}
          titulo="Carry real médio ponderado pelo peso na carteira"
        />
        <MiniStat
          rotulo="Confluence"
          valor={confluenciaCarteira && confluenciaCarteira.valor !== null ? Math.round(confluenciaCarteira.valor).toString() : "—"}
          cor={confluenciaCarteira && confluenciaCarteira.valor !== null ? COR_CONVICCAO[confluenciaCarteira.conviccao] : "text-slate-600"}
          nota={confluenciaCarteira ? `cobertura ${confluenciaCarteira.cobertura}/${confluenciaCarteira.total}` : undefined}
        />
        <MiniStat
          rotulo="Sharpe"
          valor={patrimonio && patrimonio.resultado.sharpe !== null ? patrimonio.resultado.sharpe.toFixed(2) : "—"}
          titulo="Sharpe vs. CDI, série da carteira"
        />
        <MiniStat
          rotulo="Drawdown"
          valor={patrimonio && patrimonio.resultado.drawdownMaximo !== null ? pctSinal(patrimonio.resultado.drawdownMaximo) : "—"}
          cor={patrimonio && patrimonio.resultado.drawdownMaximo !== null ? "text-red-400" : "text-slate-600"}
          titulo="Maior queda pico-a-vale da série do patrimônio"
        />
        <MiniStat
          rotulo="Caixa"
          valor="—"
          cor="text-slate-600"
          nota="sem rastreio ainda"
          titulo="O sistema não rastreia dinheiro não investido — só posições em ações. Corte honesto: nunca um saldo inventado."
        />
        <MiniStat rotulo="Posições" valor={posicoesTxt} titulo="Quantidade de posições reais registradas" />
      </div>

      {/* ================= LINHA 2 — gráfico (70%) + Resumo IA / Alertas / Radar / Oportunidades (30%) ================= */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-10">
        <Bloco
          titulo="Performance · Carteira vs. CDI/Ibovespa/IPCA"
          acao={carteira ? { href: "/carteira", rotulo: "carteira completa" } : undefined}
          className="xl:col-span-7"
        >
          {patrimonio && patrimonio.resultado.pontos.length >= 2 ? (
            <GraficoPatrimonio pontos={patrimonio.resultado.pontos} />
          ) : (
            <p className="text-[12px] leading-relaxed text-slate-500">
              {!patrimonio || patrimonio.posicoesForaDaSerie.length === 0 ? (
                <>Ainda não há série suficiente (2+ pregões) desde a data de compra para desenhar o gráfico.</>
              ) : (
                <>
                  Falta a data de compra de{" "}
                  <span className="font-mono text-slate-400">{patrimonio.posicoesForaDaSerie.join(", ")}</span>.
                  Nunca estimamos essa data por você —{" "}
                  <Link href="/carteira" className="text-sky-400 hover:underline">registre em /carteira →</Link>
                </>
              )}
            </p>
          )}
        </Bloco>

        <div className="flex flex-col gap-2 xl:col-span-3">
          <Bloco titulo="Resumo IA" className="flex-1">
            <p className="text-[11px] font-semibold text-slate-200">{saudacao}, Carlos.</p>
            <p className={`mt-1 line-clamp-3 text-[10.5px] leading-snug ${precisaAgir ? "text-amber-200" : "text-slate-400"}`}>
              {frases[0]}
            </p>
            {lider && (
              <p className="mt-1.5 text-[10px] text-slate-500">
                Tese mais forte:{" "}
                <Link href={`/tese/${lider.ticker}`} className="font-mono text-slate-200 hover:underline">
                  {lider.ticker}
                </Link>{" "}
                <span className="font-mono text-emerald-400">{lider.score_final}</span>
              </p>
            )}
            <p className="mt-1 text-[8.5px] leading-snug text-slate-700">
              100% texto por regras — nunca um modelo de linguagem decidindo.
            </p>
          </Bloco>

          <Bloco titulo="Alertas" acao={{ href: "/replay", rotulo: "replay" }} className="flex-1">
            <div className="flex gap-4">
              <MiniNum rotulo="Gatilhos 24h" valor={gat24} alerta={gat24 > 0} />
              <MiniNum rotulo="Mudanças 24h" valor={mud24} alerta={mud24 > 0} />
              <MiniNum rotulo="Em revisão" valor={emRevisao} alerta={emRevisao > 0} />
            </div>
            {eventos.length > 0 ? (
              <p className="mt-1.5 line-clamp-2 text-[10px] leading-snug text-slate-400">
                <span className="font-mono text-sky-400/90">{eventos[0].teses?.ticker}</span> · {eventos[0].explicacao}
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] text-slate-500">Nada mudou nas últimas 48h.</p>
            )}
          </Bloco>

          <Bloco titulo="Radar" acao={{ href: "/radar", rotulo: "ver 40" }} className="flex-1">
            {radarLinhas.length === 0 ? (
              <p className="text-[10.5px] text-slate-500">Sem dados suficientes hoje.</p>
            ) : (
              <div className="space-y-1">
                {radarLinhas.slice(0, 4).map((r) => (
                  <Link
                    key={r.ticker}
                    href={`/tese/${r.ticker}`}
                    className="flex items-center gap-1.5 text-[10.5px] hover:opacity-80"
                  >
                    <span className="w-14 shrink-0 truncate font-mono text-slate-300">{r.ticker}</span>
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div className="h-full rounded-full bg-sky-400/60" style={{ width: `${Math.max(2, r.nota)}%` }} />
                    </div>
                    <span className={`w-6 shrink-0 text-right font-mono font-semibold ${corNota(r.nota)}`}>{r.nota}</span>
                  </Link>
                ))}
              </div>
            )}
          </Bloco>

          <Bloco titulo="Oportunidades" acao={{ href: "/radar", rotulo: "ver as 40" }} className="flex-1">
            {topCandidatas.length === 0 ? (
              <p className="text-[10.5px] text-slate-500">Sem candidatas com dados suficientes hoje.</p>
            ) : (
              <div className="space-y-1">
                {topCandidatas.map((c) => (
                  <Link
                    key={c.ticker}
                    href={`/tese/${c.ticker}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-mono text-[11px] font-semibold text-slate-200">{c.ticker}</span>
                    </span>
                    <Sparkline valores={[...(precosPorTicker.get(c.ticker) ?? [])].reverse().map((p) => Number(p.fechamento))} />
                    <span className={`shrink-0 text-[13px] font-bold ${corNota(c.nota)}`}>{c.nota}</span>
                  </Link>
                ))}
              </div>
            )}
          </Bloco>
        </div>
      </div>

      {/* ================= LINHA 3 — Minha Carteira (~65%) + Saúde da Carteira (~35%) =================
          Versão RESUMIDA da tabela: sem Qtd/Preço médio/Valor investido/Valor
          atual (já cobertos pelos cards da Linha 1) e SEM os botões
          "editar"/"excluir" — decisão deliberada: AcoesPosicao chama um
          server action com checagem de usuário logado e acesso admin que
          hoje só existe em src/app/carteira/page.tsx; duplicá-lo aqui (ou
          expor um botão que parece funcional mas não faz nada) seria o
          tipo de UI enganosa que o "corte honesto" do projeto proíbe. O
          link "carteira completa →" é o caminho real para editar/excluir. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Bloco
          titulo={`Minha Carteira${carteira ? ` (${carteira.linhas.length})` : ""}`}
          acao={{ href: "/carteira", rotulo: "carteira completa" }}
          className="xl:col-span-2"
        >
          {carteira ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-left text-[9px] uppercase tracking-wider text-slate-600">
                    <th className="py-1 pr-2">Empresa</th>
                    <th className="py-1 pr-2 text-right">Peso</th>
                    <th className="py-1 pr-2 text-right">Resultado</th>
                    <th className="py-1 pr-2 text-right">Nota</th>
                    <th className="py-1 text-right">Confluence</th>
                  </tr>
                </thead>
                <tbody>
                  {carteira.linhas.map((l) => {
                    const notaLinha = notaPorTicker.get(l.ticker);
                    const conf = confluenciaPorTicker.get(l.ticker);
                    return (
                      <tr key={l.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                        <td className="py-1 pr-2">
                          <Link href={`/tese/${l.ticker}`} className="hover:underline">
                            <span className="font-mono font-semibold">{l.ticker}</span>
                          </Link>
                          {!statusPorTicker.has(l.ticker) && (
                            <span
                              className="ml-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[8px] text-amber-300"
                              title="Posição sem tese escrita ainda"
                            >
                              sem tese
                            </span>
                          )}
                        </td>
                        <td className="py-1 pr-2 text-right font-mono text-slate-300">{pct(l.peso)}</td>
                        <td className={`py-1 pr-2 text-right font-mono ${corResultado(l.resultado)}`}>
                          {l.resultado !== null ? pct(l.resultadoPct) : "—"}
                        </td>
                        <td className="py-1 pr-2 text-right font-mono text-slate-300">
                          {notaLinha !== undefined ? Math.round(notaLinha) : "—"}
                        </td>
                        <td className="py-1 text-right">
                          {conf && conf.score !== null ? (
                            <span className={`rounded-full border px-1.5 py-0.5 text-[9.5px] font-mono ${CHIP_CONVICCAO[conf.conviccao]}`}>
                              {conf.score}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-[12px] leading-relaxed text-slate-500">
              {posicoes === null ? (
                <>O módulo está pronto; falta aplicar a migração 014 no banco.</>
              ) : (
                <>
                  Registre suas posições reais (quantidade e preço médio) e este bloco passa a mostrar peso,
                  resultado, nota e Confluence por posição.{" "}
                  <Link href="/carteira" className="text-sky-400 hover:underline">registrar posições →</Link>
                </>
              )}
            </p>
          )}
        </Bloco>

        <Bloco titulo="Saúde da Carteira" acao={{ href: "/carteira", rotulo: "ver completo" }} className="xl:col-span-1">
          {saude ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                <StatMini
                  rotulo="Concentração"
                  valor={ROTULO_CONCENTRACAO[saude.concentracaoRotulo]}
                  cor={COR_CONCENTRACAO[saude.concentracaoRotulo]}
                  nota={saude.maiorPosicao ? `maior: ${saude.maiorPosicao.ticker}` : undefined}
                />
                <StatMini
                  rotulo="Volatilidade"
                  valor={
                    patrimonio && patrimonio.resultado.volatilidadeAnualizada !== null
                      ? `${(patrimonio.resultado.volatilidadeAnualizada * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                      : "—"
                  }
                />
                <StatMini rotulo="ROIC médio" valor={pct(saude.roicMedioPonderado)} nota={`cobertura ${saude.cobertura.roic}/${saude.cobertura.total}`} />
                <StatMini rotulo="Valuation médio" valor={pct(saude.earningsYieldMedioPonderado)} nota="lucro 12m ÷ valor de mercado" />
                <StatMini
                  rotulo="Sensib. Selic"
                  valor={
                    saude.sensibilidadeSelicMedia.categoria
                      ? ROTULO_SENSIBILIDADE[saude.sensibilidadeSelicMedia.categoria]
                      : "—"
                  }
                />
                <StatMini rotulo="Posições" valor={String(saude.cobertura.total)} />
              </div>
              {saude.alocacaoPorModelo.length > 0 && (
                <div className="mt-2.5 space-y-1 border-t border-white/5 pt-2">
                  <p className="text-[8.5px] uppercase tracking-wider text-slate-600">Modelo de negócio</p>
                  {saude.alocacaoPorModelo.slice(0, 3).map((m) => (
                    <div key={m.rotulo} className="flex items-center gap-1.5 text-[10px]">
                      <span className="w-20 shrink-0 truncate text-slate-400">{m.rotulo}</span>
                      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-sky-400/60" style={{ width: `${Math.max(2, m.pct * 100)}%` }} />
                      </div>
                      <span className="w-9 shrink-0 text-right font-mono text-slate-300">{pct(m.pct)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="text-[11.5px] leading-relaxed text-slate-500">
              {!carteira || posicoes === null
                ? "Registre posições em /carteira para habilitar a Saúde da Carteira."
                : "Falta preço atual de alguma posição para medir concentração, Carry ou ROIC ponderados honestamente."}
            </p>
          )}
        </Bloco>
      </div>

      {/* ================= LINHA 4 — Timeline · Decision Feed · Macro · Heatmap (largura inteira) ================= */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Bloco titulo="Timeline · Mudanças (48h)" acao={{ href: "/replay", rotulo: "replay completo" }}>
          {eventos.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Nada mudou nas últimas 48h — dia tranquilo é o sistema dizendo: suas teses seguem de pé.
            </p>
          ) : (
            <div className="space-y-2 border-l border-white/10 pl-3">
              {eventos.slice(0, 6).map((e) => (
                <div key={e.id} className="relative">
                  <span className="absolute -left-[15.5px] top-1 h-1.5 w-1.5 rounded-full bg-sky-400/70" />
                  <p className="text-[8.5px] uppercase tracking-wider text-slate-600">
                    {fmtHora(e.criado_em)} ·{" "}
                    <Link href={`/tese/${e.teses?.ticker}`} className="font-mono text-sky-400/90 hover:underline">
                      {e.teses?.ticker}
                    </Link>{" "}
                    · {e.tipo.replace(/_/g, " ")}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-slate-300">{e.explicacao}</p>
                </div>
              ))}
            </div>
          )}
        </Bloco>

        <Bloco titulo="Decision Feed" acao={{ href: "/diario", rotulo: "diário" }}>
          {decisionFeed.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Sem dado técnico suficiente ainda para sugerir prioridade por posição.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {decisionFeed.map((f) => (
                <div
                  key={f.ticker}
                  title={f.explicacao}
                  className={`rounded-md border px-1.5 py-1 text-[10px] ${SUGESTAO_COR[f.sugestao]}`}
                >
                  <span className="font-mono font-semibold">{f.ticker}</span>{" "}
                  <span className="opacity-90">{ROTULO_SUGESTAO[f.sugestao]}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-2.5 space-y-1 border-t border-white/5 pt-2">
            <p className="text-[8.5px] uppercase tracking-wider text-slate-600">Últimas decisões (Diário)</p>
            {decisoes.length === 0 ? (
              <p className="text-[10px] text-slate-500">Nenhuma decisão registrada ainda.</p>
            ) : (
              decisoes.map((d) => (
                <div key={d.id} className="flex items-center justify-between text-[10px]">
                  <span>
                    <span className="font-mono font-semibold">{d.ticker}</span>
                    <span className="ml-1.5 text-slate-400">{DECISAO_TXT[d.decisao] ?? d.decisao}</span>
                  </span>
                  <span className="text-slate-600">{fmtHora(d.criado_em)}</span>
                </div>
              ))
            )}
          </div>
          <p className="mt-1.5 text-[8px] leading-snug text-slate-700">100% por regras explícitas — nunca &quot;comprar&quot;/&quot;vender&quot;.</p>
        </Bloco>

        <Bloco titulo="Cenário Macro (Focus/BCB)">
          {focusPorInd.size === 0 ? (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Sem dado Focus ainda — depende da migração 012 no banco.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2.5">
              {["IPCA", "Selic", "PIB Total", "Câmbio"].map((ind) => {
                const f = focusPorInd.get(ind);
                if (!f) return null;
                const delta = f.anterior !== null ? f.atual - f.anterior : null;
                return (
                  <div key={ind}>
                    <p className="text-[8.5px] uppercase tracking-wider text-slate-500">{ind}</p>
                    <p className="font-mono text-[13px] font-semibold text-slate-100">
                      {f.atual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}
                      {ind === "Câmbio" ? "" : "%"}
                      {delta !== null && Math.abs(delta) >= 0.01 && (
                        <span className={`ml-1 text-[10px] ${delta > 0 ? "text-amber-300" : "text-sky-300"}`}>
                          {delta > 0 ? "▲" : "▼"}
                        </span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          <p className="mt-2.5 border-t border-white/5 pt-2 text-[8px] leading-snug text-slate-700">
            Focus/BCB, {new Date().getFullYear()} · projeção de mercado, não decisão do sistema.
          </p>
        </Bloco>

        <Bloco titulo="Heatmap · Retorno por posição">
          {carteira && carteira.linhas.length > 0 ? (
            <div className="grid grid-cols-4 gap-1">
              {carteira.linhas.map((l) => (
                <div
                  key={l.ticker}
                  title={`${l.ticker} · ${l.resultadoPct !== null ? pctSinal(l.resultadoPct) : "sem preço atual"}`}
                  className="flex aspect-square flex-col items-center justify-center rounded-md"
                  style={{ background: corHeatmapRetorno(l.resultadoPct) }}
                >
                  <span className="font-mono text-[9px] font-semibold text-slate-100">{l.ticker}</span>
                  <span className="text-[7.5px] text-slate-300">
                    {l.resultadoPct !== null ? pctSinal(l.resultadoPct, 0) : "—"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Registre posições em /carteira para ver o heatmap de retorno.
            </p>
          )}
          <p className="mt-2 text-[8px] leading-snug text-slate-700">
            Cor por resultado % sobre o preço médio — intensidade satura em ±30%.
          </p>
        </Bloco>
      </div>

      {/* ================= abaixo da 1ª dobra — Universo por nota (ranking completo) ================= */}
      <Bloco
        titulo="Empresas · Universo por nota (oficial)"
        acao={{ href: "/ranking", rotulo: "ranking" }}
      >
        {notaMedia !== null && (
          <p className="mb-2 text-[10.5px] text-slate-500">
            Nota média do universo hoje:{" "}
            <span className="font-mono font-semibold text-slate-200">{notaMedia.toFixed(0)}</span>
            {deltaNota !== null && deltaNota !== 0 && (
              <span className={`ml-1.5 font-mono ${deltaNota > 0 ? "text-emerald-400" : "text-red-400"}`}>
                {deltaNota > 0 ? "▲" : "▼"} {Math.abs(deltaNota).toFixed(1)} desde o pregão anterior
              </span>
            )}
          </p>
        )}
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
      </Bloco>
    </Shell>
  );
}
