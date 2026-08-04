import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { Sparkline } from "@/components/Sparkline";
import { GraficoPatrimonio } from "@/components/GraficoPatrimonio";
import { calcularRadar, candidatas } from "@/lib/radar";
import { consolidarCarteira, type Posicao } from "@/lib/carteira";
import { calcularPatrimonio } from "@/lib/patrimonio-dados";
import { calcularTechnicals } from "@/lib/technical-dados";
import { calcularCompounders } from "@/lib/compounder-dados";
import { montarDecisions } from "@/lib/decision-dados";
import type { Decision } from "@/lib/decision-object";
import { montarPortfolioFitCarteira } from "@/lib/portfolio-fit-dados";
import type { ResultadoPortfolioFit } from "@/lib/portfolio-fit";
import { montarStatusTeses } from "@/lib/thesis-status-dados";
import { ROTULO_STATUS_DERIVADO, type PerfilTese, type StatusDerivadoTese } from "@/lib/thesis-engine";
import { montarSaudeCarteiraV2, type SaudeCarteiraV2 } from "@/lib/dash-agregados";
import {
  mediaSetor,
  compararComSetor,
  fraseCarryComContexto,
  fraseConfluenceComContexto,
  type ComparacaoSetorial,
} from "@/lib/dash-narrativa";
import {
  classificarSeveridadeAlerta,
  ordenarPorSeveridade,
  contarPorSeveridade,
  ROTULO_SEVERIDADE,
  type SeveridadeAlerta,
  type TipoEventoAlerta,
} from "@/lib/alertas";
import { gerarDecisionFeed, ROTULO_SUGESTAO, type DecisionFeedEntrada, type SugestaoFeed } from "@/lib/decision-feed";
import type { Conviccao } from "@/lib/confluencia";
import { ROTULO_SENSIBILIDADE } from "@/lib/compounder/sensibilidade-juros";
import { corHeatmapRetorno } from "@/lib/heatmap";
import { mediaPonderada, calcularSaudeCarteira, montarLinhasSaude } from "@/lib/portfolio-health";
import { montarWealthHealth, ROTULO_BANDA_WEALTH_HEALTH, type WealthHealth } from "@/lib/wealth-health";
import { montarPortfolioAttribution } from "@/lib/portfolio-attribution";
import { identificarAmeacasCarteira } from "@/lib/portfolio-risk";
import { gerarAprendizadosCarteira } from "@/lib/portfolio-lessons";
import { bucketizarQuickActions, ROTULO_BALDE } from "@/lib/quick-actions";
import { montarDecisoesPrioritarias } from "@/lib/decisoes-prioritarias";
import { montarIntelligenceCapsulePatrimonio } from "@/lib/wealth-intelligence-capsule";
import { calcularWealthEngine } from "@/lib/wealth-engine";
import { gerarCoachInsight } from "@/lib/coach-insights";
import { InvestmentCoach } from "@/components/InvestmentCoach";
import { IntelligenceCapsuleCard } from "@/components/IntelligenceCapsuleCard";

export const dynamic = "force-dynamic";

/**
 * MEU DASH — Sprint 2.1 (Bloco 2, 04/08/2026): primeira tela a consumir o
 * Decision Object do Foundation (Master Engine + Confluence v2 + Carry
 * v2/escada de 5 níveis + Portfolio Fit + Thesis Engine).
 *
 * DECISÃO DE ESCOPO EXPLÍCITA (Opção A, escolhida pelo Carlos via pergunta
 * direta): SÓ esta tela usa o Decision Object. `/carteira`, `/radar`,
 * `/ranking` e a rota de cron `/api/teses/avaliar` continuam 100% em v1
 * (confluencia.ts de 4 componentes, Carry de radar.ts) até serem migradas
 * numa sprint futura — migração explicitamente registrada como pendência,
 * não esquecida. CONSEQUÊNCIA VISÍVEL E ACEITA: o Carry e o Confluence
 * mostrados aqui PODEM divergir numericamente do que `/carteira` mostra
 * hoje para o mesmo ticker. Nunca escondida — cards e colunas afetados
 * levam o rótulo "Foundation v2" e tooltip explicando a divergência.
 *
 * Toda conta pesada (Master Engine, Portfolio Fit, Thesis Engine, Saúde da
 * Carteira v2) roda em src/lib/*-dados.ts / dash-agregados.ts — esta
 * página só busca dado bruto que falta e desenha. Nenhum cálculo no
 * frontend.
 *
 * Regra inegociável mantida do redesign anterior: todo número renderizado
 * vem de uma variável calculada a partir de dado real — nunca um valor
 * decorativo; onde falta motor ou dado, "—" com o motivo (Caixa, Growth
 * Médio).
 */

type ScoreRow = {
  ticker: string;
  data: string;
  score_final: number;
  confianca: string;
  empresas: { nome: string } | null;
};
type TeseRow = { ticker: string; status: string; criado_em: string };
type EventoRow = {
  id: number;
  tipo: string;
  explicacao: string;
  criado_em: string;
  teses: { ticker: string } | null;
  gatilhos: { direcao: "positivo" | "negativo" } | null;
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
const COR_STATUS_DERIVADO: Record<StatusDerivadoTese, string> = {
  construindo: "text-slate-400 bg-white/[0.03] border-white/10",
  confirmada: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  fortalecendo: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  enfraquecendo: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  quebrada: "text-red-300 bg-red-500/10 border-red-500/30",
  invalida: "text-red-300 bg-red-500/10 border-red-500/30",
};
const COR_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  critico: "text-red-300 bg-red-500/10 border-red-500/30",
  importante: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  informativo: "text-slate-500 bg-white/[0.03] border-white/10",
};
const ROTULO_LIQUIDEZ: Record<"alta" | "media" | "baixa", string> = {
  alta: "Alta", media: "Média", baixa: "Baixa",
};
const COR_LIQUIDEZ: Record<"alta" | "media" | "baixa", string> = {
  alta: "text-emerald-300", media: "text-sky-300", baixa: "text-amber-300",
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
const preco2 = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Seta de comparação setorial (dash-narrativa.ts) — ▲/▼/≈, nunca cor sem explicação (title fica na célula-mãe). */
function SetaComparacao({ comparacao }: { comparacao: ComparacaoSetorial }) {
  if (comparacao === "acima") return <span className="ml-1 text-emerald-400">▲</span>;
  if (comparacao === "abaixo") return <span className="ml-1 text-red-400">▼</span>;
  if (comparacao === "na_media") return <span className="ml-1 text-slate-500">≈</span>;
  return null;
}

/** Card compacto da Barra Superior — altura fixa (84px, dentro do teto de 90px pedido), corte honesto embutido via "—". */
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
  titulo, subtitulo, acao, children, className = "",
}: { titulo: string; subtitulo?: string; acao?: { href: string; rotulo: string }; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col rounded-[16px] border border-white/[0.06] bg-white/[0.03] p-3.5 ${className}`}>
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-[10px] text-slate-500">{subtitulo}</p>}
        </div>
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
  rotulo, valor, cor = "text-slate-100", nota, titulo,
}: { rotulo: string; valor: string; cor?: string; nota?: string; titulo?: string }) {
  return (
    <div title={titulo}>
      <p className="truncate text-[8.5px] uppercase tracking-wider text-slate-500">{rotulo}</p>
      <p className={`truncate font-mono text-[13px] font-bold ${cor}`}>{valor}</p>
      {nota && <p className="truncate text-[8.5px] leading-snug text-slate-600">{nota}</p>}
    </div>
  );
}

/** Trio de números pequenos (severidade de alertas) — Linha 2, painel Alertas. */
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
    supabase.from("teses").select("ticker, status, criado_em").eq("ativa", true),
    supabase
      .from("eventos_tese")
      .select("id, tipo, explicacao, criado_em, teses(ticker), gatilhos(direcao)")
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
  const tesesLinhas = (tesesRaw as TeseRow[]) ?? [];
  const statusPorTicker = new Map(tesesLinhas.map((t) => [t.ticker, t.status]));
  const criadoEmPorTicker = new Map(tesesLinhas.map((t) => [t.ticker, t.criado_em]));
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

  // ---------- Goal Engine (Seção 2, Sprint 2.8) ----------
  // `patrimonioObjetivo` fica SEMPRE null nesta versão — não existe hoje
  // nenhum lugar (tabela/form) onde o Carlos possa registrar uma meta
  // patrimonial. Escrever uma migração nova pra isso, com 3 migrações
  // (022/023) já travadas pelo mesmo bloqueio de conector Supabase, seria
  // empilhar mais um item sem forma de testar — decisão registrada no
  // roadmap para o Carlos ratificar, não fabricada silenciosamente.
  // CAGR histórico/CAGR real acima da inflação (que NÃO dependem de meta)
  // aparecem reais; tempo estimado/gap ficam "Em desenvolvimento".
  const wealthEngineResultado = patrimonio ? calcularWealthEngine({ patrimonio: patrimonio.resultado, patrimonioObjetivo: null }) : null;

  // ---------- Decision Object (Foundation v4, Opção A — só esta tela) ----------
  let decisionFeed: ReturnType<typeof gerarDecisionFeed> = [];
  let decisions = new Map<string, Decision>();
  let portfolioFitPorTicker = new Map<string, ResultadoPortfolioFit>();
  let statusTesesPorTicker = new Map<string, PerfilTese>();
  let saudeV2: SaudeCarteiraV2 | null = null;
  // ---------- Wealth Operating System (Bloco 2, Sprint 2.8) ----------
  let wealthHealth: WealthHealth | null = null;
  let ameacasCarteira: ReturnType<typeof identificarAmeacasCarteira> = [];
  let attribution: ReturnType<typeof montarPortfolioAttribution> | null = null;
  let aprendizadosCarteira: ReturnType<typeof gerarAprendizadosCarteira> = [];
  let wealthCoachInsight: ReturnType<typeof gerarCoachInsight> = null;
  let quickActions: ReturnType<typeof bucketizarQuickActions> = { hoje: [], esta_semana: [], este_mes: [] };
  const fdieAgregadoCarteira = { ok: 0, alerta: 0, critico: 0, total: 0 };

  if (carteira && carteira.linhas.length > 0) {
    const [technicalLinhas, compounderLinhas] = await Promise.all([
      calcularTechnicals(supabase),
      calcularCompounders(supabase),
    ]);
    // mapa "achatado" (só o resultado) — formato que o Decision Feed (v1, decision-feed.ts) já espera
    const technicalResultadoPorTicker = new Map(technicalLinhas.map((t) => [t.ticker, t.resultado]));
    // mapa "cheio" — formato que montarDecisions (decision-dados.ts) espera
    const technicalPorTicker = new Map(technicalLinhas.map((t) => [t.ticker, t]));
    const compounderPorTicker = new Map(compounderLinhas.map((c) => [c.ticker, c]));
    const setorPorTicker = new Map(radarLinhas.map((r) => [r.ticker, r.setor]));
    // fundamentosScore/fundamentosComponentes = a mesma nota oficial que o Radar já calcula
    // (calcularScorePorModelo) — nenhuma conta nova, só reaproveitada aqui.
    const fundamentosPorTicker = new Map(radarLinhas.map((r) => [r.ticker, { nota: r.nota, componentes: r.componentes }]));
    // universo inteiro (não só a carteira) — necessário pra "média do setor hoje"
    // (dash-narrativa.ts) ter comparação honesta além das próprias posições.
    const universoTickers = radarLinhas.map((r) => r.ticker);
    const geradoEm = new Date().toISOString();

    const decisionsResultado = await montarDecisions(
      supabase, universoTickers, fundamentosPorTicker, compounderPorTicker, technicalPorTicker, geradoEm
    );
    decisions = decisionsResultado.porTicker;

    const posicoesFit = carteira.linhas
      .filter((l): l is typeof l & { peso: number } => l.peso !== null)
      .map((l) => ({ ticker: l.ticker, peso: l.peso }));
    const fitResultado = await montarPortfolioFitCarteira(supabase, posicoesFit, decisions, compounderPorTicker, setorPorTicker);
    portfolioFitPorTicker = fitResultado.porTicker;

    statusTesesPorTicker = await montarStatusTeses(supabase, carteira.linhas.map((l) => l.ticker), decisions, geradoEm);

    saudeV2 = montarSaudeCarteiraV2(carteira.linhas, radarLinhas, compounderLinhas, decisions, fitResultado.volumeMedioReaisPorTicker);

    // ---------- Wealth Health (Seção 1) + Attribution (Seção 4) + Risco (Seção 5) + Aprendizados (Seção 8) ----------
    // Nenhum motor novo — só composição sobre saudeV2/decisions/portfolioFitPorTicker já calculados acima.
    const linhasComPeso = carteira.linhas.filter((l): l is typeof l & { peso: number } => l.peso !== null);

    const qualityMedio = mediaPonderada(linhasComPeso.map((l) => ({ peso: l.peso, valor: decisions.get(l.ticker)?.quality ?? null })));
    const fitMedio = mediaPonderada(linhasComPeso.map((l) => ({ peso: l.peso, valor: portfolioFitPorTicker.get(l.ticker)?.scoreEncaixe ?? null })));
    const drawdownMedio = mediaPonderada(linhasComPeso.map((l) => ({ peso: l.peso, valor: decisions.get(l.ticker)?.expectedDrawdown.valor ?? null })));

    wealthHealth = montarWealthHealth({
      confluenceMedio: saudeV2.confluenceV2.valor,
      carryMedioPonderado: saudeV2.saude.carryMedioPonderado,
      concentracaoRotulo: saudeV2.saude.concentracaoRotulo,
      liquidezRotulo: saudeV2.liquidez.rotulo,
      qualityMedioPonderado: qualityMedio.valor,
      portfolioFitMedioPonderado: fitMedio.valor,
      drawdownEsperadoMedioPonderado: drawdownMedio.valor,
    });

    for (const l of linhasComPeso) {
      const d = decisions.get(l.ticker);
      if (d) {
        fdieAgregadoCarteira.ok += d.fdie.ok;
        fdieAgregadoCarteira.alerta += d.fdie.alerta;
        fdieAgregadoCarteira.critico += d.fdie.critico;
        fdieAgregadoCarteira.total += d.fdie.total;
      }
    }

    ameacasCarteira = identificarAmeacasCarteira({
      concentracaoRotulo: saudeV2.saude.concentracaoRotulo,
      maiorPosicao: saudeV2.saude.maiorPosicao,
      carryMedioPonderado: saudeV2.saude.carryMedioPonderado,
      qualitiesPonderadas: linhasComPeso.map((l) => ({ ticker: l.ticker, peso: l.peso, quality: decisions.get(l.ticker)?.quality ?? null })),
      liquidezRotulo: saudeV2.liquidez.rotulo,
      posicoesComFdieCritico: linhasComPeso.filter((l) => (decisions.get(l.ticker)?.fdie.critico ?? 0) > 0).map((l) => l.ticker),
      totalPosicoes: linhasComPeso.length,
    });

    attribution = montarPortfolioAttribution(
      linhasComPeso.map((l) => ({ ticker: l.ticker, peso: l.peso, resultadoPct: l.resultadoPct, carryReal: decisions.get(l.ticker)?.carry ?? null }))
    );

    // Aprendizados da Carteira: compara Saúde ANTES/DEPOIS da posição mais recente por `data_compra` real (migração 016).
    const linhasComData = linhasComPeso.filter((l) => l.dataCompra !== null);
    if (linhasComData.length > 0) {
      const maisRecente = [...linhasComData].sort((a, b) => (b.dataCompra as string).localeCompare(a.dataCompra as string))[0];
      const linhasAntes = carteira.linhas.filter((l) => l.ticker !== maisRecente.ticker);
      if (linhasAntes.length > 0) {
        const linhasSaudeAntes = montarLinhasSaude(linhasAntes, radarLinhas, compounderLinhas).map((l) => ({ ...l, carryReal: decisions.get(l.ticker)?.carry ?? null }));
        const saudeAntes = calcularSaudeCarteira(linhasSaudeAntes);
        const qualityAntes = mediaPonderada(
          linhasAntes.filter((l): l is typeof l & { peso: number } => l.peso !== null).map((l) => ({ peso: l.peso, valor: decisions.get(l.ticker)?.quality ?? null }))
        );
        aprendizadosCarteira = gerarAprendizadosCarteira(
          { concentracaoRotulo: saudeAntes.concentracaoRotulo, carryMedioPonderado: saudeAntes.carryMedioPonderado, qualityMedioPonderado: qualityAntes.valor, alocacaoPorModelo: saudeAntes.alocacaoPorModelo },
          { concentracaoRotulo: saudeV2.saude.concentracaoRotulo, carryMedioPonderado: saudeV2.saude.carryMedioPonderado, qualityMedioPonderado: qualityMedio.valor, alocacaoPorModelo: saudeV2.saude.alocacaoPorModelo },
          maisRecente.ticker
        );
      }
    }

    // Wealth Coach (Seção 8): 1 Coach Insight pro Meu Dash inteiro, tirado da maior posição — mesmo padrão do Decision Center (Sprint 2.7).
    if (saudeV2.saude.maiorPosicao) {
      const tickerMaior = saudeV2.saude.maiorPosicao.ticker;
      const dMaior = decisions.get(tickerMaior);
      const rMaior = radarLinhas.find((r) => r.ticker === tickerMaior) ?? null;
      if (dMaior) {
        const linhasSetorLocal = Array.from(decisions.values()).map((d) => ({ ticker: d.ticker, setor: d.setor }));
        wealthCoachInsight = gerarCoachInsight({
          carryReal: dMaior.carry,
          carryComparacaoSetor: compararComSetor(dMaior.carry, mediaSetor(tickerMaior, dMaior.setor, linhasSetorLocal, (l) => decisions.get(l.ticker)?.carry ?? null)),
          roicAtual: rMaior?.roic4 ?? null,
          roicVariacaoRelativa: null,
          earningsYield: rMaior?.ey ?? null,
          quality: dMaior.quality,
          growth: dMaior.growth,
          technical: dMaior.technical,
        });
      }
    }

    const entradasFeed: DecisionFeedEntrada[] = carteira.linhas.map((l) => {
      const tec = technicalResultadoPorTicker.get(l.ticker);
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

  // Comparadores setoriais (dash-narrativa.ts) — "hoje", nunca "histórica"; só existem tickers com Decision.
  const linhasParaMediaSetor = Array.from(decisions.values()).map((d) => ({ ticker: d.ticker, setor: d.setor }));
  function carryComparacao(ticker: string): { media: number | null; comparacao: ComparacaoSetorial } {
    const d = decisions.get(ticker);
    if (!d) return { media: null, comparacao: "indisponivel" };
    const media = mediaSetor(ticker, d.setor, linhasParaMediaSetor, (l) => decisions.get(l.ticker)?.carry ?? null);
    return { media, comparacao: compararComSetor(d.carry, media) };
  }
  function confluenceComparacao(ticker: string): { media: number | null; comparacao: ComparacaoSetorial } {
    const d = decisions.get(ticker);
    if (!d) return { media: null, comparacao: "indisponivel" };
    const media = mediaSetor(ticker, d.setor, linhasParaMediaSetor, (l) => decisions.get(l.ticker)?.confluence ?? null);
    return { media, comparacao: compararComSetor(d.confluence, media) };
  }

  // ---------- hero / eventos ----------
  const eventos = (eventosRaw as unknown as EventoRow[]) ?? [];
  const agora = Date.now();
  const ev24 = eventos.filter((e) => agora - new Date(e.criado_em).getTime() < 24 * 3_600_000);
  const gat24 = ev24.filter((e) => e.tipo === "gatilho_disparado").length;
  const mud24 = ev24.filter((e) => e.tipo === "mudanca_status").length;
  const precisaAgir = gat24 + mud24 > 0;

  // ---------- Alertas com severidade (Crítico/Importante/Informativo) ----------
  // Reaproveita sinais que já existem (FDIE do Decision Object, Thesis Engine, direção do gatilho)
  // — src/lib/alertas.ts só prioriza, não inventa risco novo.
  const TIPOS_ALERTA = new Set(["gatilho_disparado", "mudanca_status", "criacao", "revisao"]);
  const alertasClassificados = eventos.map((e) => {
    const ticker = e.teses?.ticker ?? null;
    const d = ticker ? decisions.get(ticker) : undefined;
    const fdieCritico = d ? d.fdie.critico > 0 : false;
    const thesisStatus = ticker ? statusTesesPorTicker.get(ticker)?.thesisStatus ?? null : null;
    const tipo = (TIPOS_ALERTA.has(e.tipo) ? e.tipo : "revisao") as TipoEventoAlerta;
    const { severidade, motivo } = classificarSeveridadeAlerta({
      tipo, gatilhoDirecao: e.gatilhos?.direcao ?? null, fdieCritico, thesisStatus,
    });
    return { evento: e, severidade, motivo };
  });
  const alertasOrdenados = ordenarPorSeveridade(alertasClassificados);
  const contagemSeveridade = contarPorSeveridade(alertasClassificados);

  // ---------- Quick Actions (Seção 11, Sprint 2.8) ----------
  // "Nenhuma lógica duplicada... tudo vindo do Decision Center" — reusa
  // EXATAMENTE `montarDecisoesPrioritarias`/`classificarUrgencia`
  // (decisoes-prioritarias.ts), mesma função que a tela /decisoes chama.
  if (carteira && carteira.linhas.length > 0) {
    const severidadesPorTicker = new Map<string, SeveridadeAlerta[]>();
    for (const a of alertasClassificados) {
      const ticker = a.evento.teses?.ticker;
      if (!ticker) continue;
      const arr = severidadesPorTicker.get(ticker) ?? [];
      arr.push(a.severidade);
      severidadesPorTicker.set(ticker, arr);
    }
    const entradasPrioritariasDash = carteira.linhas
      .map((l) => {
        const decision = decisions.get(l.ticker);
        if (!decision) return null;
        return {
          ticker: l.ticker,
          empresa: l.ticker,
          decision,
          perfilTese: statusTesesPorTicker.get(l.ticker) ?? null,
          severidadesRecentes: severidadesPorTicker.get(l.ticker) ?? [],
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
    quickActions = bucketizarQuickActions(montarDecisoesPrioritarias(entradasPrioritariasDash, 10));
  }

  // ---------- Intelligence Capsule do Patrimônio (Seção 9, Sprint 2.8) ----------
  const tesesQuebradasDash = [...statusTesesPorTicker.values()].filter(
    (p) => p.thesisStatus === "quebrada" || p.thesisStatus === "invalida"
  ).length;
  const gapMetaTexto =
    wealthEngineResultado && wealthEngineResultado.cagrRealAcimaInflacao !== null
      ? `CAGR real acima da inflação: ${pctSinal(wealthEngineResultado.cagrRealAcimaInflacao)} — sem meta patrimonial configurada ainda pra calcular o gap até um objetivo.`
      : null;
  const wealthCapsule = wealthHealth
    ? montarIntelligenceCapsulePatrimonio({
        wealthHealth,
        tesesQuebradas: tesesQuebradasDash,
        totalTeses: statusTesesPorTicker.size,
        fdie: fdieAgregadoCarteira,
        gapMetaTexto,
      })
    : null;

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

  // Hero Executivo — uma frase contextualizada de Carry pra maior posição (nunca "Carry: X%" solto).
  const maiorPosicao = carteira && carteira.linhas.length > 0
    ? [...carteira.linhas].sort((a, b) => (b.peso ?? 0) - (a.peso ?? 0))[0]
    : null;
  let fraseDestaqueCarry: string | null = null;
  if (maiorPosicao) {
    const d = decisions.get(maiorPosicao.ticker);
    if (d) {
      const { comparacao } = carryComparacao(maiorPosicao.ticker);
      fraseDestaqueCarry = `${maiorPosicao.ticker} (maior posição): ${fraseCarryComContexto(d.carry, comparacao)}`;
    }
  }

  return (
    <Shell ativo="/" titulo="Meu Dash" subtitulo={hoje} rolagem>
      {/* ================= HERO EXECUTIVO ================= */}
      <div className="rounded-[18px] border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent p-5">
        <p className="text-[11px] text-slate-500">{saudacao}, Carlos · {hoje}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-3">
          <h1 className="font-mono text-[32px] font-bold leading-none text-slate-50">
            {carteira && carteira.valorAtual !== null ? brl(carteira.valorAtual) : "—"}
          </h1>
          {carteira && carteira.resultado !== null && carteira.resultadoPct !== null && (
            <span className={`font-mono text-[17px] font-semibold ${corResultado(carteira.resultado)}`}>
              {pctSinal(carteira.resultadoPct)}
            </span>
          )}
        </div>
        <p className={`mt-2 max-w-3xl text-[13px] leading-relaxed ${precisaAgir ? "text-amber-200" : "text-slate-300"}`}>
          {frases[0]}
        </p>
        {fraseDestaqueCarry && (
          <p className="mt-1 max-w-3xl text-[11px] leading-relaxed text-slate-500">{fraseDestaqueCarry}</p>
        )}

        {/* ================= SEÇÃO 1 — WEALTH HEALTH (Sprint 2.8) ================= */}
        {wealthHealth && (
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/[0.06] pt-3">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Saúde Patrimonial</p>
              <div className="mt-0.5 flex items-baseline gap-2">
                <span className="font-mono text-[24px] font-bold text-slate-50">{wealthHealth.score ?? "—"}</span>
                <span className="text-[12px] font-semibold text-slate-300">{ROTULO_BANDA_WEALTH_HEALTH[wealthHealth.banda]}</span>
              </div>
            </div>
            <div className="flex flex-1 flex-wrap gap-x-4 gap-y-1">
              {wealthHealth.componentes.map((c) => (
                <span key={c.chave} className="text-[9.5px] text-slate-500" title={`Peso ${c.peso} — ${c.disponivel ? "disponível" : "sem dado hoje"}`}>
                  {c.rotulo}: <span className={c.disponivel ? "font-mono text-slate-300" : "font-mono text-slate-700"}>{c.disponivel ? Math.round(c.pontos as number) : "—"}</span>
                </span>
              ))}
            </div>
            {/* ================= SEÇÃO 10 — TRUST LAYER (discreto, ao lado) ================= */}
            <span
              className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-1 text-[9.5px] text-slate-400"
              title={`FDIE: ${fdieAgregadoCarteira.ok} ok, ${fdieAgregadoCarteira.alerta} alerta, ${fdieAgregadoCarteira.critico} crítico de ${fdieAgregadoCarteira.total} verificações`}
            >
              {fdieAgregadoCarteira.total === 0
                ? "Sem verificação hoje"
                : fdieAgregadoCarteira.critico > 0
                ? "★★☆☆☆ Auditado — crítico encontrado"
                : fdieAgregadoCarteira.alerta > 0
                ? "★★★☆☆ Auditado — com alerta"
                : "★★★★★ Auditado"}
            </span>
          </div>
        )}
      </div>

      {/* ================= SEÇÃO 9 — INTELLIGENCE CAPSULE DO PATRIMÔNIO (Sprint 2.8) ================= */}
      {wealthCapsule && (
        <Bloco titulo="Cápsula do Patrimônio">
          <IntelligenceCapsuleCard capsula={wealthCapsule} />
        </Bloco>
      )}

      {/* ================= SEÇÃO 8 — WEALTH COACH (Sprint 2.8) ================= */}
      <InvestmentCoach insight={wealthCoachInsight} />

      {/* ================= BARRA SUPERIOR — 10 cards compactos, ≤90px ================= */}
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
          rotulo="Atual"
          valor={carteira && carteira.valorAtual !== null ? brlCompacto(carteira.valorAtual) : "—"}
          titulo="Mesmo valor do card Patrimônio — o sistema não separa caixa/outros ativos de ações hoje, corte honesto explícito."
        />
        <MiniStat
          rotulo="Lucro"
          valor={carteira && carteira.resultado !== null ? brlCompacto(carteira.resultado) : "—"}
          cor={carteira && carteira.resultado !== null ? corResultado(carteira.resultado) : "text-slate-600"}
          titulo={carteira && carteira.resultado !== null ? brl(carteira.resultado) : "Sem preço atual de alguma posição"}
        />
        <MiniStat
          rotulo="Rentabilidade"
          valor={carteira && carteira.resultadoPct !== null ? pctSinal(carteira.resultadoPct) : "—"}
          cor={carteira && carteira.resultado !== null ? corResultado(carteira.resultado) : "text-slate-600"}
          titulo="Resultado ÷ valor investido"
        />
        <MiniStat
          rotulo="Alpha vs. CDI"
          valor={patrimonio && patrimonio.resultado.alpha.vsCdi !== null ? pctSinal(patrimonio.resultado.alpha.vsCdi) : "—"}
          cor={patrimonio ? corAlpha(patrimonio.resultado.alpha.vsCdi) : "text-slate-600"}
          titulo="Desde a data de compra registrada, vs. CDI simulado"
        />
        <MiniStat
          rotulo="Carry médio"
          valor={saudeV2 && saudeV2.saude.carryMedioPonderado !== null ? `IPCA+${(saudeV2.saude.carryMedioPonderado * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}
          nota="Foundation v2"
          titulo="Carry do Decision Object (escada de 5 níveis) — pode divergir do Carry mostrado em /carteira (v1) até essa tela também migrar. Divergência registrada em roadmap/status-execucao.md."
        />
        <MiniStat
          rotulo="Confluence"
          valor={saudeV2 && saudeV2.confluenceV2.valor !== null ? Math.round(saudeV2.confluenceV2.valor).toString() : "—"}
          cor={saudeV2 && saudeV2.confluenceV2.valor !== null ? COR_CONVICCAO[saudeV2.confluenceV2.conviccao] : "text-slate-600"}
          nota="Foundation v2 · 8 comp."
          titulo="Confluence Score de 8 componentes (Foundation v2) — pode divergir do Confluence de /carteira (4 componentes, v1) até essa tela também migrar."
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
              <MiniNum rotulo="Crítico" valor={contagemSeveridade.critico} alerta={contagemSeveridade.critico > 0} />
              <MiniNum rotulo="Importante" valor={contagemSeveridade.importante} alerta={contagemSeveridade.importante > 0} />
              <MiniNum rotulo="Informativo" valor={contagemSeveridade.informativo} />
            </div>
            {alertasOrdenados.length > 0 ? (
              <div className="mt-1.5 space-y-1">
                {alertasOrdenados.slice(0, 3).map((a) => (
                  <p key={a.evento.id} className="line-clamp-1 text-[10px] leading-snug text-slate-400" title={a.motivo}>
                    <span className={`mr-1 rounded-full border px-1 text-[8px] ${COR_SEVERIDADE[a.severidade]}`}>
                      {ROTULO_SEVERIDADE[a.severidade]}
                    </span>
                    <span className="font-mono text-sky-400/90">{a.evento.teses?.ticker}</span> · {a.evento.explicacao}
                  </p>
                ))}
              </div>
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
          Versão RESUMIDA da tabela: sem Qtd/Valor investido/Valor atual em R$
          (já cobertos pelos cards da Barra Superior) e SEM os botões
          "editar"/"excluir" — decisão deliberada: AcoesPosicao chama um
          server action com checagem de usuário logado e acesso admin que
          hoje só existe em src/app/carteira/page.tsx; duplicá-lo aqui (ou
          expor um botão que parece funcional mas não faz nada) seria o
          tipo de UI enganosa que o "corte honesto" do projeto proíbe. O
          link "carteira completa →" é o caminho real para editar/excluir. */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <Bloco
          titulo={`Minha Carteira${carteira ? ` (${carteira.linhas.length})` : ""} · Foundation v2`}
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
                    <th className="py-1 pr-2 text-right">Preço médio</th>
                    <th className="py-1 pr-2 text-right">Cotação</th>
                    <th className="py-1 pr-2 text-right">Rentab.</th>
                    <th className="py-1 pr-2 text-right">Carry</th>
                    <th className="py-1 pr-2 text-right">Confluence</th>
                    <th className="py-1 pr-2 text-right">Fit</th>
                    <th className="py-1 pr-2">Status da tese</th>
                    <th className="py-1 text-right">Revisão</th>
                  </tr>
                </thead>
                <tbody>
                  {carteira.linhas.map((l) => {
                    const d = decisions.get(l.ticker);
                    const perfil = statusTesesPorTicker.get(l.ticker);
                    const fit = portfolioFitPorTicker.get(l.ticker);
                    const { comparacao: compCarry } = carryComparacao(l.ticker);
                    const { comparacao: compConf } = confluenceComparacao(l.ticker);
                    const revisaoEm = criadoEmPorTicker.get(l.ticker);
                    const statusLegado = statusPorTicker.get(l.ticker);
                    const statusTxt = perfil ? ROTULO_STATUS_DERIVADO[perfil.thesisStatus] : statusLegado ? STATUS_TXT[statusLegado] : null;
                    const statusCor = perfil
                      ? COR_STATUS_DERIVADO[perfil.thesisStatus]
                      : statusLegado
                      ? STATUS_CHIP[statusLegado]
                      : "text-slate-600 bg-white/[0.03] border-white/10";
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
                        <td className="py-1 pr-2 text-right font-mono text-slate-500">{preco2(l.precoMedio)}</td>
                        <td className="py-1 pr-2 text-right font-mono text-slate-300">
                          {l.precoAtual !== null ? preco2(l.precoAtual) : "—"}
                        </td>
                        <td className={`py-1 pr-2 text-right font-mono ${corResultado(l.resultado)}`}>
                          {l.resultado !== null ? pct(l.resultadoPct) : "—"}
                        </td>
                        <td
                          className="py-1 pr-2 text-right font-mono text-slate-300"
                          title={d ? fraseCarryComContexto(d.carry, compCarry) : "Sem Decision Object calculável para este ticker."}
                        >
                          {d && d.carry !== null ? (
                            <>
                              IPCA+{(d.carry * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                              <SetaComparacao comparacao={compCarry} />
                            </>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td
                          className="py-1 pr-2 text-right"
                          title={d ? fraseConfluenceComContexto(d.confluence, compConf) : "Sem Decision Object calculável para este ticker."}
                        >
                          {d && d.confluence !== null ? (
                            <span className={`rounded-full border px-1.5 py-0.5 text-[9.5px] font-mono ${CHIP_CONVICCAO[d.conviccao]}`}>
                              {d.confluence}
                              <SetaComparacao comparacao={compConf} />
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td
                          className="py-1 pr-2 text-right font-mono text-slate-300"
                          title={fit ? `Portfolio Fit — ${fit.componentesDisponiveis}/${fit.componentesTotal} componentes calculáveis (${fit.metodo}).` : "Sem Portfolio Fit calculável."}
                        >
                          {fit && fit.scoreEncaixe !== null ? Math.round(fit.scoreEncaixe) : "—"}
                        </td>
                        <td className="py-1 pr-2">
                          {statusTxt ? (
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] ${statusCor}`}>{statusTxt}</span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                        <td className="py-1 text-right text-[10px] text-slate-500">
                          {revisaoEm ? fmtHora(revisaoEm) : "—"}
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
                  resultado, Carry, Confluence e Portfolio Fit por posição.{" "}
                  <Link href="/carteira" className="text-sky-400 hover:underline">registrar posições →</Link>
                </>
              )}
            </p>
          )}
        </Bloco>

        <Bloco titulo="Saúde da Carteira · Foundation v2" acao={{ href: "/carteira", rotulo: "ver completo" }} className="xl:col-span-1">
          {saudeV2 ? (
            <>
              <div className="grid grid-cols-2 gap-x-3 gap-y-2.5">
                <StatMini
                  rotulo="Concentração"
                  valor={ROTULO_CONCENTRACAO[saudeV2.saude.concentracaoRotulo]}
                  cor={COR_CONCENTRACAO[saudeV2.saude.concentracaoRotulo]}
                  nota={saudeV2.saude.maiorPosicao ? `maior: ${saudeV2.saude.maiorPosicao.ticker}` : undefined}
                />
                <StatMini
                  rotulo="Diversificação"
                  valor={`${saudeV2.saude.alocacaoPorModelo.length} modelo${saudeV2.saude.alocacaoPorModelo.length === 1 ? "" : "s"}`}
                  nota="de negócio distintos"
                />
                <StatMini
                  rotulo="Carry médio"
                  valor={saudeV2.saude.carryMedioPonderado !== null ? `IPCA+${(saudeV2.saude.carryMedioPonderado * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}
                  nota={`Foundation v2 · cobertura ${saudeV2.saude.cobertura.carry}/${saudeV2.saude.cobertura.total}`}
                />
                <StatMini
                  rotulo="ROIC médio"
                  valor={pct(saudeV2.saude.roicMedioPonderado)}
                  nota={`cobertura ${saudeV2.saude.cobertura.roic}/${saudeV2.saude.cobertura.total}`}
                />
                <StatMini
                  rotulo="Growth médio"
                  valor="—"
                  cor="text-slate-600"
                  nota="sem motor real ainda"
                  titulo="Decision.growth não tem motor real construído — corte honesto, nunca um número inventado."
                />
                <StatMini
                  rotulo="Liquidez"
                  valor={saudeV2.liquidez.rotulo ? ROTULO_LIQUIDEZ[saudeV2.liquidez.rotulo] : "—"}
                  cor={saudeV2.liquidez.rotulo ? COR_LIQUIDEZ[saudeV2.liquidez.rotulo] : "text-slate-600"}
                  nota={saudeV2.liquidez.valor !== null ? `~${brlCompacto(saudeV2.liquidez.valor)}/dia` : undefined}
                  titulo="Volume financeiro médio ponderado, últimos ~30 pregões por posição. Limiares (alta ≥R$10mi/dia, baixa <R$1mi/dia) são convenção de mercado, não dado calculado."
                />
                <StatMini
                  rotulo="Macro (Selic)"
                  valor={saudeV2.saude.sensibilidadeSelicMedia.categoria ? ROTULO_SENSIBILIDADE[saudeV2.saude.sensibilidadeSelicMedia.categoria] : "—"}
                  titulo={saudeV2.saude.sensibilidadeSelicMedia.explicacao}
                />
                <StatMini
                  rotulo="Convicção"
                  valor={saudeV2.confluenceV2.valor !== null ? Math.round(saudeV2.confluenceV2.valor).toString() : "—"}
                  cor={saudeV2.confluenceV2.valor !== null ? COR_CONVICCAO[saudeV2.confluenceV2.conviccao] : "text-slate-600"}
                  nota={`Confluence v2 · cobertura ${saudeV2.confluenceV2.cobertura}/${saudeV2.confluenceV2.total}`}
                />
              </div>
              {saudeV2.saude.alocacaoPorModelo.length > 0 && (
                <div className="mt-2.5 space-y-1 border-t border-white/5 pt-2">
                  <p className="text-[8.5px] uppercase tracking-wider text-slate-600">Modelo de negócio</p>
                  {saudeV2.saude.alocacaoPorModelo.slice(0, 3).map((m) => (
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

      {/* ================= SEÇÃO 2 — GOAL ENGINE (Sprint 2.8) ================= */}
      <Bloco titulo="Goal Engine">
        {wealthEngineResultado ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatMini rotulo="Meta patrimonial" valor="Em desenvolvimento" titulo="Ainda não existe onde registrar uma meta patrimonial no sistema — não fabricado. Ver roadmap." />
            <StatMini rotulo="Prazo" valor="Em desenvolvimento" titulo="Depende da meta patrimonial acima." />
            <StatMini
              rotulo="CAGR histórico"
              valor={wealthEngineResultado.cagr !== null ? pctSinal(wealthEngineResultado.cagr) : "—"}
              titulo={wealthEngineResultado.motivoSemCagr ?? "CAGR anualizado da carteira real, wealth-engine.ts"}
            />
            <StatMini
              rotulo="CAGR real acima do IPCA"
              valor={wealthEngineResultado.cagrRealAcimaInflacao !== null ? pctSinal(wealthEngineResultado.cagrRealAcimaInflacao) : "—"}
              titulo="Anualização do retorno acima da inflação"
            />
            <StatMini rotulo="Probabilidade de atingir a meta" valor="—" titulo={wealthEngineResultado.motivoSemProbabilidade} />
            <StatMini rotulo="Gap até a meta" valor="Em desenvolvimento" titulo="Depende da meta patrimonial acima." />
          </div>
        ) : (
          <p className="text-[12px] text-slate-500">Sem série de patrimônio suficiente ainda para o Wealth Engine.</p>
        )}
        <p className="mt-2 text-[9.5px] text-slate-700">
          Estrutura pronta (CAGR/tempo-até-meta/gap já existem em wealth-engine.ts) — só falta um lugar pra você
          registrar a meta patrimonial. Decisão registrada no roadmap: exige migração nova, represada atrás das
          migrações 022/023 (mesmo bloqueio de conector Supabase).
        </p>
      </Bloco>

      {/* ================= SEÇÃO 4 — PERFORMANCE ATTRIBUTION (Sprint 2.8) ================= */}
      {attribution && attribution.posicoes.length > 0 && (
        <Bloco titulo="Performance Attribution" acao={carteira ? { href: "/carteira", rotulo: "carteira completa" } : undefined}>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[9px] uppercase tracking-wider text-slate-500">
                  <th className="pb-1.5 pr-2">Empresa</th>
                  <th className="pb-1.5 pr-2 text-right">Peso</th>
                  <th className="pb-1.5 pr-2 text-right">Contrib. Retorno</th>
                  <th className="pb-1.5 pr-2 text-right">Contrib. Carry (proteção inflação)</th>
                  <th className="pb-1.5 text-right">Impacto na Concentração</th>
                </tr>
              </thead>
              <tbody>
                {[...attribution.posicoes].sort((a, b) => b.peso - a.peso).map((p) => (
                  <tr key={p.ticker} className="border-t border-white/5">
                    <td className="py-1.5 pr-2">
                      <Link href={`/tese/${p.ticker}`} className="font-mono text-slate-200 hover:underline">{p.ticker}</Link>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono text-slate-400">{(p.peso * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%</td>
                    <td className={`py-1.5 pr-2 text-right font-mono ${p.contribuicaoRetorno === null ? "text-slate-700" : p.contribuicaoRetorno >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                      {p.contribuicaoRetorno !== null ? pctSinal(p.contribuicaoRetorno) : "—"}
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                      {p.contribuicaoCarry !== null ? pctSinal(p.contribuicaoCarry) : "—"}
                    </td>
                    <td className={`py-1.5 text-right font-mono ${p.impactoConcentracao >= 0 ? "text-amber-300" : "text-emerald-400"}`}>
                      {p.impactoConcentracao >= 0 ? "+" : ""}{(p.impactoConcentracao * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}pp
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[9.5px] text-slate-700">{attribution.avisoVolatilidade}</p>
        </Bloco>
      )}

      {/* ================= SEÇÃO 5 — RISCO DA CARTEIRA (Sprint 2.8) ================= */}
      <Bloco titulo="Risco da Carteira" subtitulo="O que hoje ameaça meu patrimônio?">
        {ameacasCarteira.length === 0 ? (
          <p className="text-[12px] text-slate-500">Nenhuma ameaça identificada hoje pelos sinais que o sistema já calcula.</p>
        ) : (
          <div className="space-y-1.5">
            {ameacasCarteira.map((a) => (
              <div key={a.chave} className={`rounded-lg border px-2.5 py-1.5 text-[11px] leading-snug ${a.severidade === "alta" ? "border-red-500/30 bg-red-500/10 text-red-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>
                <span className="font-semibold">{a.titulo}: </span>{a.texto}
              </div>
            ))}
          </div>
        )}
      </Bloco>

      {/* ================= SEÇÃO 8 (continuação) — APRENDIZADOS DA CARTEIRA (Sprint 2.8) ================= */}
      {aprendizadosCarteira.length > 0 && (
        <Bloco titulo="Aprendizados da Carteira">
          <div className="space-y-1.5">
            {aprendizadosCarteira.map((l, i) => (
              <p key={i} className="text-[11.5px] leading-relaxed text-slate-300">· {l.texto}</p>
            ))}
          </div>
        </Bloco>
      )}

      {/* ================= SEÇÃO 11 — QUICK ACTIONS (Sprint 2.8) ================= */}
      <Bloco titulo="Quick Actions" subtitulo="Vem do Decision Center — nunca recalculado aqui.">
        {quickActions.hoje.length + quickActions.esta_semana.length + quickActions.este_mes.length === 0 ? (
          <p className="text-[12px] text-slate-500">Nenhuma ação pendente hoje.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {(["hoje", "esta_semana", "este_mes"] as const).map((balde) => (
              <div key={balde}>
                <p className="mb-1.5 text-[9px] uppercase tracking-wider text-slate-500">{ROTULO_BALDE[balde]}</p>
                {quickActions[balde].length === 0 ? (
                  <p className="text-[10.5px] text-slate-600">—</p>
                ) : (
                  <div className="space-y-1">
                    {quickActions[balde].map((d) => (
                      <Link key={d.ticker} href={`/tese/${d.ticker}`} className="block rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1 text-[10.5px] hover:bg-white/[0.04]">
                        <span className="font-mono font-semibold text-slate-200">{d.ticker}</span>{" "}
                        <span className="text-slate-400">{d.titulo}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Bloco>
    </Shell>
  );
}
