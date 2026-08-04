import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { calcularRadar, candidatas } from "@/lib/radar";
import { consolidarCarteira, type Posicao } from "@/lib/carteira";
import { calcularPatrimonio } from "@/lib/patrimonio-dados";
import { calcularTechnicals } from "@/lib/technical-dados";
import { calcularCompounders } from "@/lib/compounder-dados";
import { montarDecisions } from "@/lib/decision-dados";
import type { Decision } from "@/lib/decision-object";
import { montarPortfolioFitOportunidades, type EntradaPortfolioFitCarteira } from "@/lib/portfolio-fit-dados";
import { montarStatusTeses } from "@/lib/thesis-status-dados";
import type { PerfilTese } from "@/lib/thesis-engine";
import {
  classificarSeveridadeAlerta,
  ordenarPorSeveridade,
  contarPorSeveridade,
  ROTULO_SEVERIDADE,
  type SeveridadeAlerta,
  type TipoEventoAlerta,
} from "@/lib/alertas";
import {
  montarDecisoesPrioritarias,
  ROTULO_URGENCIA,
  type UrgenciaDecisao,
  type EntradaDecisaoPrioritaria,
} from "@/lib/decisoes-prioritarias";
import { montarThesisMonitor, ROTULO_TENDENCIA, type EntradaThesisMonitor } from "@/lib/thesis-monitor-dados";
import { montarActionTimeline, type EntradaBalanco, type EntradaNota, type EventoExistente } from "@/lib/action-timeline-dados";
import { gerarNarrativaIA } from "@/lib/decision-center-narrativa";
import { PainelPorQue, PainelComoCalculamos } from "@/components/PorQueComoCalculamos";
import { calcularWealthEngine } from "@/lib/wealth-engine";

export const dynamic = "force-dynamic";

/**
 * DECISION CENTER — Sprint 2.1 (Bloco 2, per numeração do Carlos), 04/08/2026.
 *
 * "Copiloto de decisões", não dashboard: responde em <20s existe decisão
 * importante hoje? carteira saudável? tese piorou/fortaleceu? oportunidade
 * excepcional? risco escondido? — nunca inventa tarefa quando não há nada
 * a fazer.
 *
 * QUATRO SUBSTITUIÇÕES HONESTAS, registradas com o Carlos antes de codar
 * (Foundation "oficialmente congelado" — nenhuma delas cria motor novo):
 *  1. Wealth Impact (Seção 5): a spec pede "probabilidade de atingir sua
 *     meta" por decisão — não existe motor estocástico (ver wealth-engine.ts).
 *     Mostra CAGR real e retorno real acima do IPCA em vez de fabricar uma
 *     probabilidade.
 *  2. Thesis Monitor (Seção 4): usa a nota oficial (`scores`, única série
 *     diária real) via `detectarMudancaNota`, não Confluence (sem histórico
 *     persistido) — ver thesis-monitor-dados.ts.
 *  3. Action Timeline (Seção 6): só 2 dos 6 tipos pedidos têm detector real
 *     hoje (balanço novo, nota mudou) — ver action-timeline-dados.ts.
 *  4. Card IA (Seção 7): template determinístico, não LLM (sem chave
 *     configurada) — ver decision-center-narrativa.ts.
 *
 * Toda conta pesada roda em src/lib/*-dados.ts e nos motores do Foundation
 * já existentes — esta página só busca dado bruto que falta, compõe e
 * desenha. Nenhum cálculo de score/Carry/Confluence acontece aqui.
 */

type TeseRow = { id: string; ticker: string; versao: number; status: "valida" | "em_revisao" | "quebrada"; criado_em: string };
type EventoRow = {
  id: number;
  tipo: string;
  explicacao: string;
  criado_em: string;
  teses: { ticker: string } | null;
  gatilhos: { direcao: "positivo" | "negativo" } | null;
};
type FundamentoCompetenciaRow = { ticker: string; competencia: string };
type ScoreRow = { ticker: string; data: string; score_final: number };

const COR_URGENCIA: Record<UrgenciaDecisao, string> = {
  critica: "text-red-300 bg-red-500/10 border-red-500/30",
  alta: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  media: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  baixa: "text-slate-400 bg-white/[0.03] border-white/10",
};
const COR_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  critico: "text-red-300 bg-red-500/10 border-red-500/30",
  importante: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  informativo: "text-slate-500 bg-white/[0.03] border-white/10",
};

function fmtHora(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}
const pctSinal = (v: number, casas = 1) => `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
const pct = (v: number | null, casas = 1) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`);

function Secao({
  titulo, subtitulo, acao, children,
}: { titulo: string; subtitulo?: string; acao?: { href: string; rotulo: string }; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-5">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-300">{titulo}</h2>
          {subtitulo && <p className="mt-0.5 text-[11px] text-slate-500">{subtitulo}</p>}
        </div>
        {acao && (
          <Link href={acao.href} className="shrink-0 text-[11px] text-sky-400 hover:underline">
            {acao.rotulo} →
          </Link>
        )}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/**
 * Painel "Por quê? / Como calculamos?" — Sprint 2.5 (Simplicity Layer):
 * mesmo dado 100% real de antes (Decision.explanation/evidences/
 * probability/expectedReturn/warnings/fdie, nenhuma conta nova), agora
 * organizado nos dois blocos que a spec pede, via componente reutilizável
 * (src/components/PorQueComoCalculamos.tsx) — primeira tela a usar o
 * toolkit do Simplicity Layer; as outras ficam para a Fase A2.
 */
function PainelExplicabilidade({ decision, perfilTese }: { decision: Decision; perfilTese: PerfilTese | null }) {
  const dadosUtilizados = [
    `Probabilidade histórica: ${decision.probability?.explicacao ?? "sem decisões registradas o suficiente no Diário para estimar."}`,
    `Retorno esperado (12m): ${
      decision.expectedReturn.valor !== null
        ? `${pctSinal(decision.expectedReturn.valor)} (intervalo ${pct(decision.expectedReturn.intervaloInferior)} a ${pct(decision.expectedReturn.intervaloSuperior)})`
        : decision.expectedReturn.motivo
    }`,
    ...decision.warnings,
  ];
  const motivosComTom = [
    ...decision.explanation.motivosPositivos.map((m) => `[A favor] ${m.texto}`),
    ...decision.explanation.motivosNegativos.map((m) => `[Contra] ${m.texto}`),
  ];
  const hipoteses =
    perfilTese && perfilTese.premissas.length + perfilTese.hipoteses.length + perfilTese.riscos.length + perfilTese.catalisadores.length > 0
      ? ["Ver estrutura completa da tese (Premissas/Hipóteses/Riscos/Catalisadores)."]
      : [];
  const limitacoes =
    hipoteses.length === 0
      ? ["Estrutura qualitativa da tese (migração 022) ainda não aplicada no banco — corte honesto, não escondido."]
      : [];

  return (
    <>
      <PainelPorQue
        conteudo={{
          dadosUtilizados,
          motoresEnvolvidos: [...motivosComTom, `Explanation Engine`, `Probability Engine`],
          evidencias: decision.evidences.map((e) => ({ descricao: e.descricao, origem: e.origem })),
          hipoteses,
          limitacoes,
        }}
      />
      <PainelComoCalculamos
        conteudo={{
          formula: "Confluence v2 = Quality 25% + Carry 20% + Technical 20% + Growth 15% + Macro 10% + Consensus 5% + Management 3% + Portfolio 2% (peso renormalizado entre os componentes disponíveis).",
          origem: `Decision Object (Foundation v3.1/v4) — FDIE: ${decision.fdie.ok} ok / ${decision.fdie.alerta} alerta / ${decision.fdie.critico} crítico.`,
          versao: decision.confluence !== null ? `Confluence ${decision.confluence}, convicção ${decision.conviccao}` : null,
          data: fmtHora(decision.generatedAt),
          linhaCvm: null,
        }}
      />
    </>
  );
}

export default async function DecisionCenter() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/decisoes" titulo="Decision Center">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const geradoEm = new Date().toISOString();
  const desde48h = new Date(new Date(geradoEm).getTime() - 48 * 3_600_000).toISOString();

  const [
    { data: tesesRaw }, { data: eventosRaw }, { data: fundamentosRaw }, { data: scoresRaw },
    { data: posicoesRaw, error: erroPosicoes }, { data: precosRaw }, radarLinhas,
  ] = await Promise.all([
    supabase.from("teses").select("id, ticker, versao, status, criado_em").eq("ativa", true),
    supabase
      .from("eventos_tese")
      .select("id, tipo, explicacao, criado_em, teses(ticker), gatilhos(direcao)")
      .gte("criado_em", desde48h)
      .order("criado_em", { ascending: false })
      .limit(30),
    supabase.from("fundamentos").select("ticker, competencia").order("competencia", { ascending: false }),
    supabase.from("scores").select("ticker, data, score_final").order("data", { ascending: false }).limit(600),
    supabase.from("posicoes").select("ticker, quantidade, preco_medio"),
    supabase.from("precos_diarios").select("ticker, data, fechamento").order("data", { ascending: false }).limit(2000),
    calcularRadar(supabase),
  ]);

  const tesesLinhas = (tesesRaw as TeseRow[]) ?? [];
  const eventos = (eventosRaw as unknown as EventoRow[]) ?? [];
  const posicoes = erroPosicoes ? null : ((posicoesRaw as Posicao[]) ?? []);

  const ultimoPreco = new Map<string, number>();
  const precosVistos = new Set<string>();
  for (const p of (precosRaw as { ticker: string; data: string; fechamento: number }[]) ?? []) {
    if (!precosVistos.has(p.ticker)) {
      precosVistos.add(p.ticker);
      ultimoPreco.set(p.ticker, Number(p.fechamento));
    }
  }
  const carteira = posicoes && posicoes.length > 0 ? consolidarCarteira(posicoes, ultimoPreco) : null;

  const patrimonioDados = await calcularPatrimonio(supabase);

  // ---------- Decision Object (Foundation, universo inteiro do Radar) ----------
  const [technicalLinhas, compounderLinhas] = await Promise.all([calcularTechnicals(supabase), calcularCompounders(supabase)]);
  const compounderPorTicker = new Map(compounderLinhas.map((c) => [c.ticker, c]));
  const technicalPorTicker = new Map(technicalLinhas.map((t) => [t.ticker, t]));
  const setorPorTicker = new Map(radarLinhas.map((r) => [r.ticker, r.setor]));
  const fundamentosPorTicker = new Map(radarLinhas.map((r) => [r.ticker, { nota: r.nota, componentes: r.componentes }]));
  const universoTickers = radarLinhas.map((r) => r.ticker);

  const decisionsResultado = await montarDecisions(
    supabase, universoTickers, fundamentosPorTicker, compounderPorTicker, technicalPorTicker, geradoEm
  );
  const decisions = decisionsResultado.porTicker;

  const tesesTickers = tesesLinhas.map((t) => t.ticker);
  const perfilTesePorTicker: Map<string, PerfilTese> = await montarStatusTeses(supabase, tesesTickers, decisions, geradoEm);

  // ---------- Alertas com severidade (mesmo motor do Meu Dash, alertas.ts) ----------
  const TIPOS_ALERTA = new Set(["gatilho_disparado", "mudanca_status", "criacao", "revisao"]);
  const alertasClassificados = eventos.map((e) => {
    const ticker = e.teses?.ticker ?? null;
    const d = ticker ? decisions.get(ticker) : undefined;
    const fdieCritico = d ? d.fdie.critico > 0 : false;
    const thesisStatus = ticker ? perfilTesePorTicker.get(ticker)?.thesisStatus ?? null : null;
    const tipo = (TIPOS_ALERTA.has(e.tipo) ? e.tipo : "revisao") as TipoEventoAlerta;
    const { severidade, motivo } = classificarSeveridadeAlerta({ tipo, gatilhoDirecao: e.gatilhos?.direcao ?? null, fdieCritico, thesisStatus });
    return { evento: e, ticker, severidade, motivo };
  });
  const alertasOrdenados = ordenarPorSeveridade(alertasClassificados);
  const contagemSeveridade = contarPorSeveridade(alertasClassificados);
  const severidadesPorTicker = new Map<string, SeveridadeAlerta[]>();
  for (const a of alertasClassificados) {
    if (!a.ticker) continue;
    const arr = severidadesPorTicker.get(a.ticker) ?? [];
    arr.push(a.severidade);
    severidadesPorTicker.set(a.ticker, arr);
  }

  // ---------- Seção 1: Decisões Prioritárias (decisoes-prioritarias.ts) ----------
  const entradasPrioritarias: EntradaDecisaoPrioritaria[] = tesesLinhas
    .map((t) => {
      const decision = decisions.get(t.ticker);
      if (!decision) return null;
      return {
        ticker: t.ticker,
        empresa: decision.empresa,
        decision,
        perfilTese: perfilTesePorTicker.get(t.ticker) ?? null,
        severidadesRecentes: severidadesPorTicker.get(t.ticker) ?? [],
      };
    })
    .filter((e): e is EntradaDecisaoPrioritaria => e !== null);
  const decisoesPrioritarias = montarDecisoesPrioritarias(entradasPrioritarias, 5);

  // ---------- Seção 2: Oportunidades (Radar candidatas × Portfolio Fit, uso original do motor) ----------
  const topCandidatas = candidatas(radarLinhas, 5);
  const posicoesFit: EntradaPortfolioFitCarteira[] = carteira
    ? carteira.linhas.filter((l): l is typeof l & { peso: number } => l.peso !== null).map((l) => ({ ticker: l.ticker, peso: l.peso }))
    : [];
  const fitOportunidades = await montarPortfolioFitOportunidades(
    supabase,
    topCandidatas.map((c) => ({ ticker: c.ticker, setor: c.setor })),
    posicoesFit,
    decisions,
    compounderPorTicker,
    setorPorTicker
  );
  // ordenado por IMPACTO ESPERADO NO PATRIMÔNIO (Carry real × peso hipotético), nunca por nota — pedido explícito da spec
  const oportunidadesOrdenadas = [...topCandidatas].sort((a, b) => {
    const impA = (decisions.get(a.ticker)?.carry ?? 0) * 0.05;
    const impB = (decisions.get(b.ticker)?.carry ?? 0) * 0.05;
    return impB - impA;
  });

  // ---------- Seção 4: Thesis Monitor (nota oficial, thesis-monitor-dados.ts) ----------
  const notasPorTicker = new Map<string, { data: string; nota: number }[]>();
  for (const s of (scoresRaw as ScoreRow[]) ?? []) {
    const arr = notasPorTicker.get(s.ticker) ?? [];
    if (!arr.find((x) => x.data === s.data)) arr.push({ data: s.data, nota: s.score_final });
    notasPorTicker.set(s.ticker, arr);
  }
  const entradasThesisMonitor: EntradaThesisMonitor[] = tesesLinhas.map((t) => {
    const ns = notasPorTicker.get(t.ticker) ?? [];
    return {
      ticker: t.ticker,
      empresa: decisions.get(t.ticker)?.empresa ?? t.ticker,
      notaAnterior: ns[1]?.nota ?? null,
      notaAtual: ns[0]?.nota ?? null,
    };
  });
  const thesisMonitor = montarThesisMonitor(entradasThesisMonitor);

  // ---------- Seção 5: Wealth Impact (wealth-engine.ts, CAGR real — sem probabilidade fabricada) ----------
  const wealth = patrimonioDados ? calcularWealthEngine({ patrimonio: patrimonioDados.resultado, patrimonioObjetivo: null }) : null;

  // ---------- Seção 6: Action Timeline (action-timeline-dados.ts) ----------
  const competenciasPorTicker = new Map<string, string[]>();
  for (const f of (fundamentosRaw as FundamentoCompetenciaRow[]) ?? []) {
    const arr = competenciasPorTicker.get(f.ticker) ?? [];
    if (!arr.includes(f.competencia)) arr.push(f.competencia);
    competenciasPorTicker.set(f.ticker, arr);
  }
  const balancos: EntradaBalanco[] = tesesLinhas
    .map((t): EntradaBalanco | null => {
      const arr = competenciasPorTicker.get(t.ticker) ?? [];
      if (arr.length === 0) return null;
      const competenciaAnterior: string | null = arr.length > 1 ? arr[1] : null;
      return { ticker: t.ticker, competenciaAnterior, competenciaAtual: arr[0] };
    })
    .filter((b): b is EntradaBalanco => b !== null);
  const notasTimeline: EntradaNota[] = entradasThesisMonitor.map((e) => ({ ticker: e.ticker, notaAnterior: e.notaAnterior, notaAtual: e.notaAtual }));
  const eventosExistentes: EventoExistente[] = eventos
    .filter((e) => e.tipo === "gatilho_disparado" || e.tipo === "mudanca_status")
    .map((e) => ({ ticker: e.teses?.ticker ?? "", tipo: e.tipo as "gatilho_disparado" | "mudanca_status", explicacao: e.explicacao, criadoEm: e.criado_em }))
    .filter((e) => e.ticker !== "");
  const actionTimeline = montarActionTimeline(balancos, notasTimeline, eventosExistentes, geradoEm, 10);

  // ---------- Seção 7: Card IA (template, decision-center-narrativa.ts) ----------
  const melhorOportunidade = oportunidadesOrdenadas[0]
    ? { ticker: oportunidadesOrdenadas[0].ticker, carry: decisions.get(oportunidadesOrdenadas[0].ticker)?.carry ?? null }
    : null;
  const narrativaIA = gerarNarrativaIA({ decisoesPrioritarias, thesisMonitor, contagemAlertas: contagemSeveridade, melhorOportunidade });

  // ---------- HERO ----------
  const confluencias = tesesLinhas.map((t) => decisions.get(t.ticker)?.confluence).filter((v): v is number => v !== null && v !== undefined);
  const confluenceGeral = confluencias.length > 0 ? Math.round(confluencias.reduce((a, b) => a + b, 0) / confluencias.length) : null;
  const tesesQuebradas = [...perfilTesePorTicker.values()].filter((p) => p.thesisStatus === "quebrada" || p.thesisStatus === "invalida").length;
  const horaSP = (new Date().getUTCHours() + 21) % 24;
  const saudacao = horaSP < 12 ? "Bom dia" : horaSP < 18 ? "Boa tarde" : "Boa noite";

  return (
    <Shell ativo="/decisoes" titulo="Decision Center" subtitulo="O que precisa da sua decisão hoje — nunca uma lista de indicadores." rolagem>
      {/* ================= HERO ================= */}
      <div className="rounded-[18px] border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent p-5">
        <p className="text-[11px] text-slate-500">{saudacao}, Carlos · última atualização {fmtHora(geradoEm)}</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-4">
          <span className="font-mono text-[30px] font-bold leading-none text-slate-50">
            {confluenceGeral !== null ? confluenceGeral : "—"}
          </span>
          <span className="text-[11px] text-slate-500">Confluence Geral (média simples das teses acompanhadas)</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-4 text-[11px] text-slate-400">
          <span><span className="font-mono font-semibold text-red-300">{tesesQuebradas}</span> tese{tesesQuebradas === 1 ? "" : "s"} quebrada{tesesQuebradas === 1 ? "" : "s"}</span>
          <span><span className="font-mono font-semibold text-emerald-300">{topCandidatas.length}</span> oportunidade{topCandidatas.length === 1 ? "" : "s"}</span>
          <span><span className="font-mono font-semibold text-amber-300">{contagemSeveridade.critico + contagemSeveridade.importante}</span> alerta{contagemSeveridade.critico + contagemSeveridade.importante === 1 ? "" : "s"} (crítico + importante)</span>
        </div>
      </div>

      {/* ================= SEÇÃO 7 — Card IA (logo abaixo do Hero, é o resumo da tela) ================= */}
      <Secao titulo="O que merece minha atenção hoje?" subtitulo="Narrativa por template — 100% dado real, nunca um modelo de linguagem decidindo (sem chave de LLM configurada, ver decision-center-narrativa.ts).">
        <p className="text-[13px] leading-relaxed text-slate-200">{narrativaIA}</p>
      </Secao>

      {/* ================= SEÇÃO 1 — Decisões Prioritárias ================= */}
      <Secao titulo="Decisões Prioritárias" subtitulo="Máximo 5 — o que exige decisão sua, não uma lista de tudo.">
        {decisoesPrioritarias.length === 0 ? (
          <p className="text-[12px] leading-relaxed text-slate-500">Hoje nenhuma ação é necessária — nenhuma tese quebrou, nenhum alerta crítico ou importante apareceu.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {decisoesPrioritarias.map((d) => {
              const decision = decisions.get(d.ticker);
              if (!decision) return null;
              return (
                <div key={d.ticker} className="rounded-[14px] border border-white/5 bg-white/[0.02] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/tese/${d.ticker}`} className="font-mono text-[13px] font-semibold text-slate-100 hover:underline">{d.ticker}</Link>
                      <p className="mt-0.5 text-[11.5px] leading-snug text-slate-300">{d.titulo}</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${COR_URGENCIA[d.urgencia]}`}>{ROTULO_URGENCIA[d.urgencia]}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                    <span>Probabilidade: <span className="text-slate-300">{d.probabilidade !== null ? pct(d.probabilidade, 0) : "—"}</span></span>
                    <span>Tempo estimado: <span className="text-slate-300">~{d.tempoEstimadoMinutos} min</span></span>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-snug text-slate-500">{d.impactoEsperado}</p>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[10.5px] font-semibold text-sky-200">{d.acao}</span>
                    <Link href={`/tese/${d.ticker}`} className="text-[10.5px] text-sky-400 hover:underline">Analisar →</Link>
                  </div>
                  <PainelExplicabilidade decision={decision} perfilTese={d.ticker ? perfilTesePorTicker.get(d.ticker) ?? null : null} />
                </div>
              );
            })}
          </div>
        )}
      </Secao>

      {/* ================= SEÇÃO 2 — Oportunidades ================= */}
      <Secao titulo="Oportunidades" subtitulo="Ordenado por impacto esperado no patrimônio (Carry × peso hipotético de 5%), nunca por nota." acao={{ href: "/radar", rotulo: "ver radar completo" }}>
        {oportunidadesOrdenadas.length === 0 ? (
          <p className="text-[12px] text-slate-500">Sem candidatas com dados suficientes hoje.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {oportunidadesOrdenadas.map((c) => {
              const decision = decisions.get(c.ticker);
              const fit = fitOportunidades.get(c.ticker);
              return (
                <div key={c.ticker} className="rounded-[14px] border border-white/5 bg-white/[0.02] p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/tese/${c.ticker}`} className="font-mono text-[13px] font-semibold text-slate-100 hover:underline">{c.ticker}</Link>
                    <span className="text-[9.5px] text-slate-600">nota {c.nota}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-slate-500">
                    <span>Carry: <span className="text-slate-300">{decision?.carry !== null && decision?.carry !== undefined ? `IPCA+${(decision.carry * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</span></span>
                    <span>Confluence: <span className="text-slate-300">{decision?.confluence ?? "—"}</span></span>
                    <span>Portfolio Fit: <span className="text-slate-300" title="Simulado com peso hipotético de 5% — nunca uma recomendação de tamanho de posição.">{fit?.scoreEncaixe ?? "—"}</span></span>
                    <span>Probabilidade: <span className="text-slate-300">{decision?.probability?.probabilidade !== null && decision?.probability?.probabilidade !== undefined ? pct(decision.probability.probabilidade, 0) : "—"}</span></span>
                  </div>
                  <p className="mt-1.5 text-[10.5px] leading-snug text-slate-500">
                    {decision?.carry !== null && decision?.carry !== undefined
                      ? `Maior risco identificado: ${decision.explanation.motivosNegativos[0]?.texto ?? "nenhum motivo negativo relevante encontrado."}`
                      : "Sem Carry calculável — motor sem entrada suficiente para esta empresa."}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </Secao>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {/* ================= SEÇÃO 3 — Alertas ================= */}
        <Secao titulo="Alertas" subtitulo="Separados por severidade — nunca misturados." acao={{ href: "/replay", rotulo: "replay completo" }}>
          {(["critico", "importante", "informativo"] as SeveridadeAlerta[]).map((sev) => {
            const doGrupo = alertasOrdenados.filter((a) => a.severidade === sev);
            if (doGrupo.length === 0) return null;
            return (
              <div key={sev} className="mb-3 last:mb-0">
                <p className={`inline-block rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${COR_SEVERIDADE[sev]}`}>{ROTULO_SEVERIDADE[sev]} ({doGrupo.length})</p>
                <div className="mt-1.5 space-y-1.5">
                  {doGrupo.slice(0, 4).map((a) => (
                    <div key={a.evento.id} className="text-[11px] leading-snug text-slate-400">
                      <span className="font-mono text-sky-400/90">{a.evento.teses?.ticker}</span> · {a.evento.explicacao}
                      <p className="text-[9.5px] text-slate-600">{a.motivo}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
          {alertasOrdenados.length === 0 && <p className="text-[12px] text-slate-500">Nada mudou nas últimas 48h.</p>}
        </Secao>

        {/* ================= SEÇÃO 4 — Thesis Monitor ================= */}
        <Secao titulo="Thesis Monitor" subtitulo="Só teses cuja nota oficial mudou — nunca a lista inteira. Nota, não Confluence (ver corte honesto no cabeçalho do arquivo).">
          {thesisMonitor.length === 0 ? (
            <p className="text-[12px] text-slate-500">Nenhuma tese mudou de nota o suficiente para virar sinal.</p>
          ) : (
            <div className="space-y-2">
              {thesisMonitor.map((t) => (
                <Link key={t.ticker} href={`/tese/${t.ticker}`} className="flex items-center justify-between gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-1.5 hover:bg-white/[0.04]">
                  <span className="font-mono text-[12px] font-semibold text-slate-200">{t.ticker}</span>
                  <span className={`font-mono text-[13px] font-bold ${t.tendencia === "subindo" ? "text-emerald-400" : "text-red-400"}`}>
                    {ROTULO_TENDENCIA[t.tendencia]} {t.notaAnterior}→{t.notaAtual}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Secao>
      </div>

      {/* ================= SEÇÃO 5 — Wealth Impact ================= */}
      <Secao titulo="Wealth Impact" subtitulo="Como a carteira real está performando — CAGR e retorno acima da inflação. Sem meta cadastrada, sem motor estocástico: nunca fabricamos 'probabilidade de atingir meta' (ver wealth-engine.ts).">
        {!wealth ? (
          <p className="text-[12px] text-slate-500">Registre posições com data de compra em /carteira para habilitar o Wealth Impact.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">CAGR real</p>
              <p className="font-mono text-[15px] font-bold text-slate-100">{wealth.cagr !== null ? pctSinal(wealth.cagr) : "—"}</p>
              {wealth.motivoSemCagr && <p className="text-[9px] text-slate-600">{wealth.motivoSemCagr}</p>}
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Retorno acima do IPCA</p>
              <p className="font-mono text-[15px] font-bold text-slate-100">{wealth.retornoRealAcimaInflacao !== null ? pctSinal(wealth.retornoRealAcimaInflacao) : "—"}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">CAGR real acima do IPCA</p>
              <p className="font-mono text-[15px] font-bold text-slate-100">{wealth.cagrRealAcimaInflacao !== null ? pctSinal(wealth.cagrRealAcimaInflacao) : "—"}</p>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">Probabilidade de atingir meta</p>
              <p className="font-mono text-[15px] font-bold text-slate-600">—</p>
              <p className="text-[9px] text-slate-600">{wealth.motivoSemProbabilidade}</p>
            </div>
          </div>
        )}
      </Secao>

      {/* ================= SEÇÃO 6 — Action Timeline ================= */}
      <Secao titulo="Action Timeline" subtitulo="Só eventos relevantes e reais — balanço novo, nota mudou, gatilho disparou, status mudou. Nunca ruído.">
        {actionTimeline.length === 0 ? (
          <p className="text-[12px] text-slate-500">Nada relevante detectado — dia tranquilo é o sistema dizendo que suas teses seguem de pé.</p>
        ) : (
          <div className="space-y-2 border-l border-white/10 pl-3">
            {actionTimeline.map((e, i) => (
              <div key={i} className="relative">
                <span className="absolute -left-[15.5px] top-1 h-1.5 w-1.5 rounded-full bg-sky-400/70" />
                <p className="text-[9px] uppercase tracking-wider text-slate-600">
                  {e.detectadoAgora ? "detectado agora" : fmtHora(e.criadoEm)} · <span className="font-mono text-sky-400/90">{e.ticker}</span>
                </p>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-300">{e.explicacao}</p>
              </div>
            ))}
          </div>
        )}
      </Secao>
    </Shell>
  );
}
