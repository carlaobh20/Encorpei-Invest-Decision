import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { METRICAS, regraEmPortugues, condicaoAtendida } from "@/lib/metricas";
import { calcularRadar } from "@/lib/radar";
import { consolidarCarteira, type Posicao } from "@/lib/carteira";
import { calcularTechnicals } from "@/lib/technical-dados";
import { calcularCompounders } from "@/lib/compounder-dados";
import { montarDecisions } from "@/lib/decision-dados";
import { montarPortfolioFitCarteira, montarPortfolioFitOportunidades, type EntradaPortfolioFitCarteira } from "@/lib/portfolio-fit-dados";
import type { ResultadoPortfolioFit } from "@/lib/portfolio-fit";
import { montarStatusTeses } from "@/lib/thesis-status-dados";
import { ROTULO_STATUS_DERIVADO } from "@/lib/thesis-engine";
import { classificarSeveridadeAlerta, type TipoEventoAlerta } from "@/lib/alertas";
import { classificarUrgencia, impactoEsperadoTexto, ROTULO_URGENCIA, type UrgenciaDecisao } from "@/lib/decisoes-prioritarias";
import { classificarTendenciaNota } from "@/lib/thesis-monitor-dados";
import { montarThesisReplay, type EventoTeseRaw, type VersaoTese } from "@/lib/thesis-replay-dados";
import { gerarInvestmentStory } from "@/lib/investment-story-narrativa";
import { mediaSetor, compararComSetor } from "@/lib/dash-narrativa";
import { gerarCoachInsight } from "@/lib/coach-insights";
import { gerarThesisLessons } from "@/lib/thesis-lessons";
import { montarIntelligenceCapsule } from "@/lib/intelligence-capsule";
import { InvestmentCoach } from "@/components/InvestmentCoach";
import { IntelligenceCapsuleCard } from "@/components/IntelligenceCapsuleCard";
import { montarForecastEmpresa } from "@/lib/empresa-forecast-dados";
import { avaliarImpactoCarteira, ROTULO_CENARIO, type CenarioMacro } from "@/lib/scenario-engine";
import { montarArvoreCausal, type NoArvoreCausal } from "@/lib/cause-effect";
import { avaliarDecisoes, type DecisaoEntrada } from "@/lib/decision-history";
import { calcularWealthEngine } from "@/lib/wealth-engine";
import { calcularPatrimonio } from "@/lib/patrimonio-dados";
import { ReplayPlayback } from "@/components/ReplayPlayback";

export const dynamic = "force-dynamic";

/**
 * EMPRESAS — INVESTMENT STORY (Bloco 2 — Sprint 2.2), 04/08/2026.
 *
 * Substitui em LUGAR (mesma rota `/tese/[ticker]`, preserva as 16+ links
 * já existentes no app) a antiga tela de tese. Pergunta única: "esta
 * empresa merece receber meu capital hoje?" — nunca uma lista de
 * indicadores soltos. Frontend não calcula nada: todo número vem do
 * Foundation (Master Engine, Confluence v2, Carry, Thesis Engine, Evidence
 * Engine, Forecast Engine, Scenario Engine, Cause & Effect Engine,
 * Portfolio Fit, Wealth Engine) via `Decision`/`PerfilTese` já montados.
 *
 * INVENTÁRIO HONESTO feito ANTES de codar (Foundation "congelado" — nada
 * disso cria motor novo, só decide o que mostrar com o que já existe):
 *  - Catalisadores/Riscos (Seções 3/4): DUAS fontes reais, mostradas juntas
 *    — os gatilhos mecânicos já vigiados (`gatilhos`/`metricas.ts`, existe
 *    desde a Fase 1) E os motivos do Explanation Engine (`Decision.
 *    explanation`). Nenhuma inventada.
 *  - Evidências (Seção 5): Evidence Engine é real, mas NENHUM coletor grava
 *    a tabela `evidencias` em produção ainda — a seção mostra isso
 *    explicitamente, não escondida atrás de "em breve".
 *  - Cause & Effect (Seção 6): motor real (`cause-effect.ts`), mas como
 *    depende de evidências (vazias hoje), a árvore quase sempre para na
 *    raiz — comportamento correto do motor (nunca inventa o próximo elo),
 *    documentado na UI, não escondido.
 *  - Forecast (Seção 7): REAL para Receita/Lucro/Margem/ROIC (`fundamentos`,
 *    DFP anual) e Carry (`carry_score`, histórico diário real desde a
 *    migração 009) — achado desta sprint: Carry TEM história persistida,
 *    ao contrário do que a Sprint 2.1 tinha registrado sobre Confluence.
 *  - Scenarios (Seção 8): REAL, mas só o canal Selic tem impacto
 *    quantificado (`scenario-engine.ts` já documenta isso) — IPCA/PIB/
 *    Dólar/Commodities sempre "—" com motivo, por design do próprio motor.
 *  - Replay (Seção 11): 5 dos 7 tipos pedidos têm fonte real (balanço,
 *    nota, Carry, mudança de tese/versão, resultado observado); "mudança
 *    do Confluence" (sem histórico persistido) e "mudança do controlador"
 *    (sem coletor) ficam de fora — nunca fabricados. "Mudança da
 *    recomendação" não existe como conceito (regra 7, nunca compra/venda)
 *    — coberta por "mudança da tese".
 *  - Wealth Impact (Seção 10): participação atual é real; impacto no
 *    CAGR/inflação/meta por EMPRESA não tem motor (Wealth Engine é
 *    carteira inteira, não por posição) — mostra "dado ainda não
 *    disponível", exatamente como a própria spec autoriza.
 *
 * Duas peças da tela antiga foram DELIBERADAMENTE retiradas (registrado em
 * `roadmap/status-execucao.md`, não escondido): "Momento — leitura técnica"
 * (`tecnica.ts`, motor legado) — superado pelo componente `technical` já
 * dentro do Confluence v2/Explanation Engine, evita dois motores técnicos
 * paralelos falando com o usuário; os 3 mini-gráficos trimestrais —
 * superados pela Seção 7 (Forecast), que já mostra histórico + estimativa
 * juntos.
 */

type Gatilho = { id: string; descricao: string; metrica: string; operador: string; valor: number; direcao: "positivo" | "negativo"; ativo: boolean };
type TeseRow = { id: string; ticker: string; versao: number; status: "valida" | "em_revisao" | "quebrada"; confianca: string; texto: string; criado_em: string; ativa: boolean };
type EventoRow = { id: number; tipo: string; explicacao: string; criado_em: string; gatilhos: { direcao: "positivo" | "negativo" } | null };
type FundRow = { competencia: string; fonte: string; receita_liquida: number | null; lucro_liquido: number | null; margem_liquida: number | null; roic: number | null; divida_liquida: number | null };
type CarryScoreRow = { data: string; carry_real: number | null };
type ComunicadoRow = { data_entrega: string; categoria: string; assunto: string; link: string };
type DecisaoRow = { id: number; ticker: string; decisao: string; justificativa: string; contexto: { preco?: number | null } | null; criado_em: string };

const BADGE_STATUS: Record<"muito_forte" | "forte" | "neutra" | "enfraquecendo" | "quebrada", { rotulo: string; cor: string }> = {
  muito_forte: { rotulo: "Muito Forte", cor: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" },
  forte: { rotulo: "Forte", cor: "text-emerald-300 border-emerald-500/30 bg-emerald-500/5" },
  neutra: { rotulo: "Neutra", cor: "text-slate-300 border-white/15 bg-white/5" },
  enfraquecendo: { rotulo: "Enfraquecendo", cor: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  quebrada: { rotulo: "Quebrada", cor: "text-red-300 border-red-500/40 bg-red-500/10" },
};

/**
 * Mapeia os 6 status derivados do Thesis Engine (construindo/confirmada/
 * fortalecendo/enfraquecendo/quebrada/invalida) pros 5 níveis pedidos por
 * ESTA spec (Muito Forte/Forte/Neutra/Enfraquecendo/Quebrada) — camada de
 * apresentação, não motor novo. "Muito Forte" usa o Confluence Score já
 * calculado (>=80) como a magnitude real que falta ao Thesis Engine hoje,
 * nunca um número inventado.
 */
function badgeStatus(thesisStatus: string, confluence: number | null): keyof typeof BADGE_STATUS {
  if (thesisStatus === "quebrada" || thesisStatus === "invalida") return "quebrada";
  if (thesisStatus === "enfraquecendo") return "enfraquecendo";
  if (thesisStatus === "fortalecendo") return confluence !== null && confluence >= 80 ? "muito_forte" : "forte";
  if (thesisStatus === "confirmada") return confluence !== null && confluence >= 80 ? "muito_forte" : "neutra";
  return "neutra"; // construindo
}

const COR_URGENCIA: Record<UrgenciaDecisao, string> = {
  critica: "text-red-300 bg-red-500/10 border-red-500/30",
  alta: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  media: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  baixa: "text-slate-400 bg-white/[0.03] border-white/10",
};

/** Vocabulário DESTA spec (Seção 13) — distinto do vocabulário de decisoes-prioritarias.ts (Decision Center), ambos proibem comprar/vender. */
const ACAO_PAINEL: Record<UrgenciaDecisao, string> = {
  critica: "Revisar tese",
  alta: "Revisar tese",
  media: "Aprofundar estudo",
  baixa: "Continuar acompanhando",
};

function fmtData(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}
const pctSinal = (v: number, casas = 1) => `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;
const pct = (v: number | null, casas = 1) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`);

function Secao({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] p-5">
      <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-slate-300">{titulo}</h2>
      {subtitulo && <p className="mt-0.5 text-[11px] text-slate-500">{subtitulo}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function renderNoCausal(no: NoArvoreCausal, chave: string): React.ReactNode {
  return (
    <div key={chave} style={{ marginLeft: no.nivel * 18 }} className="mt-1.5">
      <div className="flex items-center gap-2">
        {no.nivel > 0 && <span className="text-slate-700">↳</span>}
        <span className="text-[11.5px] text-slate-200">{no.descricao}</span>
        {no.confiabilidade && <span className="rounded-full border border-white/10 px-1.5 py-0.5 text-[8.5px] text-slate-500">{no.confiabilidade}</span>}
      </div>
      {no.filhos.map((f, i) => renderNoCausal(f, `${chave}.${i}`))}
    </div>
  );
}

export default async function EmpresaPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const tickerUp = ticker.toUpperCase();

  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo={`/tese/${tickerUp}`} titulo={tickerUp}>
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const geradoEm = new Date().toISOString();

  const [{ data: empresaRaw }, { data: tesesRaw }, radarLinhas, { data: carryRaw }, { data: scoresRaw }, { data: posicoesRaw, error: erroPosicoes }, { data: comunicadosRaw }] =
    await Promise.all([
      supabase.from("empresas").select("ticker, nome, setor").eq("ticker", tickerUp).limit(1),
      supabase.from("teses").select("id, ticker, versao, status, confianca, texto, criado_em, ativa").eq("ticker", tickerUp).order("versao", { ascending: true }),
      calcularRadar(supabase),
      supabase.from("carry_score").select("data, carry_real").eq("ticker", tickerUp).order("data", { ascending: true }).limit(400),
      supabase.from("scores").select("data, score_final").eq("ticker", tickerUp).order("data", { ascending: true }).limit(400),
      supabase.from("posicoes").select("ticker, quantidade, preco_medio"),
      supabase.from("comunicados_oficiais").select("data_entrega, categoria, assunto, link").eq("ticker", tickerUp).order("data_entrega", { ascending: false }).limit(6),
    ]);

  const empresa = (empresaRaw as { ticker: string; nome: string; setor: string | null }[] | null)?.[0] ?? null;
  if (!empresa) {
    return (
      <Shell ativo={`/tese/${tickerUp}`} titulo={tickerUp}>
        <p className="text-slate-400">
          Empresa {tickerUp} não encontrada. <Link href="/ranking" className="text-sky-400 hover:underline">← voltar ao ranking</Link>
        </p>
      </Shell>
    );
  }

  const versoesTese = (tesesRaw as TeseRow[]) ?? [];
  const teseAtiva = versoesTese.find((t) => t.ativa) ?? versoesTese[versoesTese.length - 1] ?? null;

  // ---------- Decision Object (Foundation, universo inteiro — Portfolio Fit precisa das outras posições) ----------
  const [technicalLinhas, compounderLinhas] = await Promise.all([calcularTechnicals(supabase), calcularCompounders(supabase)]);
  const compounderPorTicker = new Map(compounderLinhas.map((c) => [c.ticker, c]));
  const technicalPorTicker = new Map(technicalLinhas.map((t) => [t.ticker, t]));
  const setorPorTicker = new Map(radarLinhas.map((r) => [r.ticker, r.setor]));
  const fundamentosPorTicker = new Map(radarLinhas.map((r) => [r.ticker, { nota: r.nota, componentes: r.componentes }]));
  const universoTickers = radarLinhas.map((r) => r.ticker);

  const decisionsResultado = await montarDecisions(supabase, universoTickers, fundamentosPorTicker, compounderPorTicker, technicalPorTicker, geradoEm);
  const decision = decisionsResultado.porTicker.get(tickerUp) ?? null;

  const perfilTesePorTicker = await montarStatusTeses(supabase, [tickerUp], decisionsResultado.porTicker, geradoEm);
  const perfilTese = perfilTesePorTicker.get(tickerUp) ?? null;

  // ---------- carteira / posição atual ----------
  const posicoes = erroPosicoes ? null : ((posicoesRaw as Posicao[]) ?? []);
  const { data: precosRaw } = await supabase.from("precos_diarios").select("ticker, data, fechamento").order("data", { ascending: false }).limit(3000);
  const ultimoPreco = new Map<string, number>();
  const vistoPreco = new Set<string>();
  for (const p of (precosRaw as { ticker: string; data: string; fechamento: number }[]) ?? []) {
    if (!vistoPreco.has(p.ticker)) {
      vistoPreco.add(p.ticker);
      ultimoPreco.set(p.ticker, Number(p.fechamento));
    }
  }
  const carteira = posicoes && posicoes.length > 0 ? consolidarCarteira(posicoes, ultimoPreco) : null;
  const posicaoAtual = carteira?.linhas.find((l) => l.ticker === tickerUp) ?? null;
  const posicoesFit: EntradaPortfolioFitCarteira[] = carteira
    ? carteira.linhas.filter((l): l is typeof l & { peso: number } => l.peso !== null).map((l) => ({ ticker: l.ticker, peso: l.peso }))
    : [];

  // ---------- Seção 9: Portfolio Fit (detida vs. não detida — mesma função, uso original ou adaptado) ----------
  let fit: ResultadoPortfolioFit | null = null;
  if (posicaoAtual) {
    const r = await montarPortfolioFitCarteira(supabase, posicoesFit, decisionsResultado.porTicker, compounderPorTicker, setorPorTicker);
    fit = r.porTicker.get(tickerUp) ?? null;
  } else {
    const r = await montarPortfolioFitOportunidades(supabase, [{ ticker: tickerUp, setor: empresa.setor }], posicoesFit, decisionsResultado.porTicker, compounderPorTicker, setorPorTicker);
    fit = r.get(tickerUp) ?? null;
  }

  // ---------- Seção 1: Investment Story ----------
  const story = decision ? gerarInvestmentStory({ ticker: tickerUp, empresa: empresa.nome, setor: empresa.setor, modeloNegocio: decision.modeloNegocio, decision }) : null;

  // ---------- Catalisadores / Riscos (Seções 3/4) — gatilhos mecânicos + Explanation Engine ----------
  const { data: gatilhosRaw } = teseAtiva ? await supabase.from("gatilhos").select("id, descricao, metrica, operador, valor, direcao, ativo").eq("tese_id", teseAtiva.id) : { data: null };
  const gatilhos = (gatilhosRaw as Gatilho[] | null) ?? [];
  const fund8 = await supabase.from("fundamentos").select("competencia, fonte, receita_liquida, lucro_liquido, margem_liquida, roic, divida_liquida").eq("ticker", tickerUp).order("competencia", { ascending: false }).limit(20);
  const fundDesc = (fund8.data as FundRow[]) ?? [];
  const metricasAtuais: Record<string, number | null> = { roic: null, margem_liquida: null, divida_liquida: null, queda_preco_30d: null };
  if (fundDesc[0]) {
    metricasAtuais.margem_liquida = fundDesc[0].margem_liquida;
    metricasAtuais.divida_liquida = fundDesc[0].divida_liquida;
    const roicsTri = fundDesc.filter((f) => f.fonte === "cvm_itr" && f.roic !== null).slice(0, 4).map((f) => Number(f.roic));
    metricasAtuais.roic = roicsTri.length ? roicsTri.reduce((a, b) => a + b, 0) / roicsTri.length : fundDesc[0].roic;
  }
  const { data: precos30Raw } = await supabase.from("precos_diarios").select("data, fechamento").eq("ticker", tickerUp).gte("data", new Date(new Date(geradoEm).getTime() - 30 * 86_400_000).toISOString().slice(0, 10)).order("data", { ascending: true });
  const precos30 = (precos30Raw as { data: string; fechamento: number }[] | null) ?? [];
  if (precos30.length >= 5) {
    const max = Math.max(...precos30.map((p) => Number(p.fechamento)));
    const ultimo = Number(precos30[precos30.length - 1].fechamento);
    if (max > 0) metricasAtuais.queda_preco_30d = (max - ultimo) / max;
  }
  const gatilhosComStatus = gatilhos.map((g) => {
    const atual = metricasAtuais[g.metrica];
    const disparado = atual !== null && atual !== undefined && condicaoAtendida(g.operador, Number(atual), Number(g.valor));
    return { ...g, disparado, atual };
  });
  const catalisadoresGatilhos = gatilhosComStatus.filter((g) => g.direcao === "positivo");
  const riscosGatilhos = gatilhosComStatus.filter((g) => g.direcao === "negativo");

  // ---------- Seção 5/6: Evidence Engine + Cause & Effect ----------
  const arvoreCausal = decision
    ? montarArvoreCausal(decision.carry !== null ? `Carry atual: IPCA+${(decision.carry * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "Carry indisponível hoje", "carry", decision.evidences)
    : null;

  // ---------- Seção 7: Forecast ----------
  const dfpAscendente = [...fundDesc].filter((f) => f.fonte === "cvm_dfp").sort((a, b) => a.competencia.localeCompare(b.competencia));
  const carryAscendente = ((carryRaw as CarryScoreRow[]) ?? []).map((c) => ({ data: c.data, carryReal: c.carry_real !== null ? Number(c.carry_real) : null }));
  const forecast = montarForecastEmpresa(
    dfpAscendente.map((f) => ({ competencia: f.competencia, receita_liquida: f.receita_liquida, lucro_liquido: f.lucro_liquido, margem_liquida: f.margem_liquida, roic: f.roic })),
    carryAscendente
  );

  // ---------- Seção 8: Scenarios ----------
  const comp = compounderPorTicker.get(tickerUp);
  const cenarios: CenarioMacro[] = ["base", "otimista", "pessimista", "estressado"];
  const impactosCenario = cenarios.map((c) => avaliarImpactoCarteira(c, [{ ticker: tickerUp, alavancagem: comp?.alavancagem ?? null, retencao: comp?.retencao ?? null, modelo: decision?.modeloNegocio ?? null }]).porEmpresa[0]);

  // ---------- Seção 10: Wealth Impact ----------
  const patrimonioDados = await calcularPatrimonio(supabase);
  const wealth = patrimonioDados ? calcularWealthEngine({ patrimonio: patrimonioDados.resultado, patrimonioObjetivo: null }) : null;

  // ---------- Replay (Seção 11) + resultado observado ----------
  const eventosTeseRaw = teseAtiva ? await supabase.from("eventos_tese").select("id, tipo, explicacao, criado_em, gatilhos(direcao)").eq("tese_id", teseAtiva.id).order("criado_em", { ascending: false }).limit(60) : { data: null };
  const eventosTese = (eventosTeseRaw.data as unknown as EventoRow[] | null) ?? [];
  const { data: decisoesRaw } = await supabase.from("decisoes").select("id, ticker, decisao, justificativa, contexto, criado_em").eq("ticker", tickerUp).order("criado_em", { ascending: false });
  const decisoesEntrada: DecisaoEntrada[] = ((decisoesRaw as DecisaoRow[]) ?? []).map((d) => ({ id: d.id, ticker: d.ticker, decisao: d.decisao as DecisaoEntrada["decisao"], justificativa: d.justificativa, criadoEm: d.criado_em, precoNaDecisao: d.contexto?.preco ?? null }));
  const precoAtualMap = new Map<string, number>();
  const pAtual = ultimoPreco.get(tickerUp);
  if (pAtual !== undefined) precoAtualMap.set(tickerUp, pAtual);
  const decisoesAvaliadas = avaliarDecisoes(decisoesEntrada, precoAtualMap, geradoEm);

  const competenciasAscendente = [...new Set(fundDesc.map((f) => f.competencia))].sort().map((competencia) => ({ competencia }));
  const notasAscendente = ((scoresRaw as { data: string; score_final: number }[]) ?? []).map((s) => ({ data: s.data, nota: s.score_final }));
  const eventosTeseParaReplay: EventoTeseRaw[] = eventosTese.map((e) => ({ tipo: e.tipo, explicacao: e.explicacao, criadoEm: e.criado_em }));
  const versoesParaReplay: VersaoTese[] = versoesTese.map((v) => ({ versao: v.versao, status: v.status, criadoEm: v.criado_em }));
  const replay = montarThesisReplay(tickerUp, {
    competenciasAscendente,
    notasAscendente,
    carryAscendente,
    eventosTese: eventosTeseParaReplay,
    versoesTese: versoesParaReplay,
    decisoesAvaliadas,
  });

  // ---------- Seção 13: Decision Panel ----------
  const alertasClassificados = eventosTese.slice(0, 20).map((e) => {
    const tipo = (["gatilho_disparado", "mudanca_status", "criacao", "revisao"].includes(e.tipo) ? e.tipo : "revisao") as TipoEventoAlerta;
    return classificarSeveridadeAlerta({ tipo, gatilhoDirecao: e.gatilhos?.direcao ?? null, fdieCritico: decision ? decision.fdie.critico > 0 : false, thesisStatus: perfilTese?.thesisStatus ?? null });
  });
  const painelDecisao =
    decision && teseAtiva
      ? classificarUrgencia({ ticker: tickerUp, empresa: empresa.nome, decision, perfilTese, severidadesRecentes: alertasClassificados.map((a) => a.severidade) })
      : null;

  const tendenciaNota = classificarTendenciaNota(notasAscendente.at(-2)?.nota ?? null, notasAscendente.at(-1)?.nota ?? null);
  const badge = decision && perfilTese ? badgeStatus(perfilTese.thesisStatus, decision.confluence) : null;

  // ---------- Investment Coach Layer (Sprint 2.7) ----------
  // Nenhum motor novo: Coach Insight/Thesis Lessons/Intelligence Capsule são
  // regras/composição sobre Decision/InvestmentStory/radar já calculados
  // acima. Comparação de setor reaproveita mediaSetor/compararComSetor
  // (dash-narrativa.ts, Sprint 2.1) — mesmo comparador transversal já usado
  // no Meu Dash, nenhum número novo inventado.
  const radarPropria = radarLinhas.find((r) => r.ticker === tickerUp) ?? null;
  const roicComparacaoSetor = compararComSetor(radarPropria?.roic4 ?? null, mediaSetor(tickerUp, empresa.setor, radarLinhas, (r) => r.roic4));
  const carryComparacaoSetor = compararComSetor(decision?.carry ?? null, mediaSetor(tickerUp, empresa.setor, radarLinhas, (r) => r.carryReal));
  const roicDfpValores = dfpAscendente.map((f) => (f.roic !== null ? Number(f.roic) : null)).filter((v): v is number => v !== null);
  const roicAnterior = roicDfpValores.at(-2);
  const roicVariacaoRelativa =
    roicDfpValores.length >= 2 && roicAnterior !== undefined && roicAnterior !== 0
      ? (roicDfpValores.at(-1)! - roicAnterior) / Math.abs(roicAnterior)
      : null;
  const coachInsight = decision
    ? gerarCoachInsight({
        carryReal: decision.carry,
        carryComparacaoSetor,
        roicAtual: radarPropria?.roic4 ?? null,
        roicVariacaoRelativa,
        earningsYield: radarPropria?.ey ?? null,
        quality: decision.quality,
        growth: decision.growth,
        technical: decision.technical,
      })
    : null;
  const thesisLessons = story ? gerarThesisLessons({ story, roicComparacaoSetor, carryComparacaoSetor }) : null;
  const capsula =
    story && decision
      ? montarIntelligenceCapsule({
          story,
          fdie: decision.fdie,
          urgencia: painelDecisao?.urgencia ?? "baixa",
          motivoUrgencia: painelDecisao?.motivo ?? "Sem decisão prioritária classificável para esta empresa hoje.",
        })
      : null;

  return (
    <Shell ativo={`/tese/${tickerUp}`} titulo={`${tickerUp} — ${empresa.nome}`} subtitulo={empresa.setor ?? undefined} rolagem>
      {/* ================= HERO ================= */}
      <div className="rounded-[18px] border border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="font-mono text-[26px] font-bold leading-none text-slate-50">{tickerUp}</h1>
            <p className="mt-1 text-[13px] text-slate-300">{empresa.nome} · {empresa.setor ?? "setor não informado"}</p>
          </div>
          {badge && <span className={`rounded-full border px-3 py-1 text-[12px] font-semibold ${BADGE_STATUS[badge].cor}`}>{BADGE_STATUS[badge].rotulo}</span>}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Confluence</p><p className="font-mono text-[16px] font-bold text-slate-100">{decision?.confluence ?? "—"}</p></div>
          <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Carry</p><p className="font-mono text-[16px] font-bold text-slate-100">{decision?.carry !== null && decision?.carry !== undefined ? `IPCA+${(decision.carry * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}</p></div>
          <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Portfolio Fit</p><p className="font-mono text-[16px] font-bold text-slate-100">{fit?.scoreEncaixe ?? "—"}</p></div>
          <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Probabilidade</p><p className="font-mono text-[16px] font-bold text-slate-100">{decision?.probability?.probabilidade !== null && decision?.probability?.probabilidade !== undefined ? pct(decision.probability.probabilidade, 0) : "—"}</p></div>
          <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Última atualização</p><p className="font-mono text-[13px] font-semibold text-slate-300">{fmtData(geradoEm)}</p></div>
        </div>
      </div>

      {!teseAtiva ? (
        <Secao titulo="Sem tese ativa" subtitulo="Esta empresa está no universo acompanhado, mas ainda não tem tese registrada.">
          <p className="text-[12px] text-slate-500">
            <Link href="/radar" className="text-sky-400 hover:underline">← ver no Radar</Link>
          </p>
        </Secao>
      ) : (
        <>
          {/* ================= SEÇÃO 1 — Investment Story ================= */}
          <Secao titulo="Investment Story" subtitulo="Narrativa por template a partir do Explanation Engine + Evidence Engine — nunca texto inventado.">
            {story ? (
              <div className="space-y-3 text-[12.5px] leading-relaxed text-slate-300">
                <p><span className="text-slate-500">Quem é: </span>{story.quemE}</p>
                <p><span className="text-slate-500">Por que continua interessante: </span>{story.porQueInteressante}</p>
                {story.oQueFortalece.length > 0 && (
                  <p><span className="text-slate-500">O que fortalece: </span>{story.oQueFortalece.join(" ")}</p>
                )}
                {story.oQueEnfraquece.length > 0 && (
                  <p><span className="text-slate-500">O que enfraquece: </span>{story.oQueEnfraquece.join(" ")}</p>
                )}
                <p><span className="text-slate-500">Principal risco: </span>{story.principalRisco}</p>
                <p><span className="text-slate-500">Principal catalisador: </span>{story.principalCatalisador}</p>
                <p className="text-[9.5px] text-slate-700">{story.evidenciasUsadas} evidência(s) ativa(s) usada(s) — Evidence Engine sem coletor automático em produção hoje (ver Seção 5).</p>
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">Sem Decision Object calculável para {tickerUp} — fundamentos insuficientes.</p>
            )}
          </Secao>

          {/* ================= SEÇÃO 1.5 — Investment Coach (Bloco 2, Sprint 2.7) ================= */}
          <Secao titulo="O que aprendemos com esta empresa?" subtitulo="Camada de ensino sobre o que o Foundation já calcula — nenhuma nota/motor novo.">
            <div className="space-y-3">
              <InvestmentCoach insight={coachInsight} />
              {thesisLessons ? (
                <div className="space-y-2.5 text-[12.5px] leading-relaxed text-slate-300">
                  <p><span className="text-slate-500">Quais características fizeram esta empresa se tornar uma Compounder: </span>{thesisLessons.caracteristicasCompounder.join(" ")}</p>
                  <p><span className="text-slate-500">Quais erros poderiam destruir esta tese: </span>{thesisLessons.errosQuePodemDestruir.join(" ")}</p>
                  <p><span className="text-slate-500">O que diferencia esta empresa dos concorrentes: </span>{thesisLessons.diferencialConcorrentes}</p>
                </div>
              ) : (
                <p className="text-[12px] text-slate-500">Sem Investment Story calculável para {tickerUp} ainda.</p>
              )}
              {capsula && (
                <div>
                  <p className="mb-1.5 text-[9px] uppercase tracking-wider text-slate-500">Intelligence Capsule</p>
                  <IntelligenceCapsuleCard capsula={capsula} />
                </div>
              )}
            </div>
          </Secao>

          {/* ================= SEÇÃO 2 — Thesis Status ================= */}
          <Secao titulo="Thesis Status">
            {perfilTese ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Strength</p><p className="font-mono text-[14px] font-bold text-slate-600" title="Precisa de 2 Decision Objects no tempo — sem histórico persistido ainda.">—</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Age</p><p className="font-mono text-[14px] font-bold text-slate-100">{perfilTese.thesisAge}d</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Version</p><p className="font-mono text-[14px] font-bold text-slate-100">v{perfilTese.thesisVersion}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Status</p><p className="text-[12px] font-semibold text-slate-200">{ROTULO_STATUS_DERIVADO[perfilTese.thesisStatus]}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Nota — tendência</p><p className={`font-mono text-[14px] font-bold ${tendenciaNota === "subindo" ? "text-emerald-400" : tendenciaNota === "descendo" ? "text-red-400" : "text-slate-400"}`}>{tendenciaNota === "subindo" ? "Mais forte ↑" : tendenciaNota === "descendo" ? "Mais fraca ↓" : tendenciaNota === "estavel" ? "Neutra ≈" : "—"}</p></div>
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">Sem perfil de tese calculável.</p>
            )}
            <p className="mt-2 text-[9.5px] text-slate-700">Substituição honesta: &ldquo;a tese ficou mais forte/mais fraca&rdquo; usa a nota oficial (única série diária real), não o Thesis Strength Engine (precisa de histórico de Decision Object, ainda não persistido).</p>
          </Secao>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* ================= SEÇÃO 3 — Catalisadores ================= */}
            <Secao titulo="Catalisadores" subtitulo="Gatilhos mecânicos vigiados + Explanation Engine.">
              <div className="space-y-2">
                {catalisadoresGatilhos.map((g) => (
                  <div key={g.id} className={`rounded-lg border p-2.5 ${g.disparado ? "border-emerald-500/30 bg-emerald-500/[0.06]" : "border-white/5 bg-white/[0.02]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-medium text-slate-200">{METRICAS[g.metrica]?.nome ?? g.metrica}</span>
                      {g.disparado && <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.5 text-[9px] font-bold text-emerald-300">DISPARADO</span>}
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-slate-500">{regraEmPortugues(g.metrica, g.operador, Number(g.valor))} — origem: gatilho vigiado</p>
                  </div>
                ))}
                {decision?.explanation.motivosPositivos.map((m, i) => (
                  <div key={`exp-${i}`} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                    <p className="text-[11.5px] text-slate-200">{m.texto}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">origem: {m.origem}</p>
                  </div>
                ))}
                {catalisadoresGatilhos.length === 0 && decision?.explanation.motivosPositivos.length === 0 && <p className="text-[12px] text-slate-500">Nenhum catalisador identificado hoje.</p>}
              </div>
            </Secao>

            {/* ================= SEÇÃO 4 — Riscos ================= */}
            <Secao titulo="Riscos" subtitulo="Gatilhos mecânicos vigiados + Explanation Engine.">
              <div className="space-y-2">
                {riscosGatilhos.map((g) => (
                  <div key={g.id} className={`rounded-lg border p-2.5 ${g.disparado ? "border-red-500/30 bg-red-500/[0.06]" : "border-white/5 bg-white/[0.02]"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11.5px] font-medium text-slate-200">{METRICAS[g.metrica]?.nome ?? g.metrica}</span>
                      {g.disparado && <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[9px] font-bold text-red-300">DISPARADO</span>}
                    </div>
                    <p className="mt-0.5 text-[10.5px] text-slate-500">{regraEmPortugues(g.metrica, g.operador, Number(g.valor))} — impacto: quebra a tese se confirmado</p>
                  </div>
                ))}
                {decision?.explanation.motivosNegativos.map((m, i) => (
                  <div key={`exp-${i}`} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5">
                    <p className="text-[11.5px] text-slate-200">{m.texto}</p>
                    <p className="mt-0.5 text-[10px] text-slate-500">origem: {m.origem} — impacto estimado: componente do Confluence abaixo do limiar</p>
                  </div>
                ))}
                {riscosGatilhos.length === 0 && decision?.explanation.motivosNegativos.length === 0 && <p className="text-[12px] text-slate-500">Nenhum risco relevante identificado hoje.</p>}
              </div>
            </Secao>
          </div>

          {/* ================= SEÇÃO 5 — Evidências ================= */}
          <Secao titulo="Evidências" subtitulo="Evidence Engine — linha do tempo, origem, confiabilidade, peso. Nunca vira score.">
            {decision && decision.evidences.length > 0 ? (
              <div className="space-y-2">
                {decision.evidences.map((e, i) => (
                  <div key={i} className="rounded-lg border border-white/5 bg-white/[0.02] p-2.5 text-[11px]">
                    <p className="text-slate-200">{e.descricao}</p>
                    <p className="mt-0.5 text-slate-500">{fmtData(e.data)} · origem: {e.origem} · confiabilidade: {e.confiabilidade} · peso: {e.pesoInformativo}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[12px] leading-relaxed text-slate-500">Nenhuma evidência registrada para {tickerUp} — o Evidence Engine existe (tabela `evidencias`, Foundation v3.1), mas nenhum coletor automático grava nela em produção ainda. Corte honesto, não escondido.</p>
            )}
          </Secao>

          {/* ================= SEÇÃO 6 — Cause & Effect ================= */}
          <Secao titulo="Cause & Effect" subtitulo="Árvore de plausibilidade a partir das evidências ativas — nunca afirma causalidade provada.">
            {arvoreCausal ? (
              <>
                {renderNoCausal(arvoreCausal, "raiz")}
                {arvoreCausal.filhos.length === 0 && (
                  <p className="mt-2 text-[11px] text-slate-600">Sem evidências ativas para aprofundar esta árvore ainda (mesma pendência da Seção 5).</p>
                )}
              </>
            ) : (
              <p className="text-[12px] text-slate-500">Sem Decision Object calculável.</p>
            )}
          </Secao>

          {/* ================= SEÇÃO 7 — Forecast ================= */}
          <Secao titulo="Forecast" subtitulo="Extrapolação trailing sobre dado real — histórico e estimativa nunca misturados.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {([
                ["Receita esperada", forecast.receita, "R$"],
                ["Lucro esperado", forecast.lucro, "R$"],
                ["Margem esperada", forecast.margem, "%"],
                ["ROIC esperado", forecast.roic, "%"],
                ["Carry esperado", forecast.carry, "%"],
              ] as const).map(([nome, proj, unidade]) => (
                <div key={nome} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">{nome}</p>
                  <p className="mt-1 font-mono text-[15px] font-bold text-slate-100">
                    {proj.valorProjetado !== null
                      ? unidade === "R$" ? proj.valorProjetado.toLocaleString("pt-BR", { style: "currency", currency: "BRL", notation: "compact" }) : pct(proj.valorProjetado)
                      : "—"}
                  </p>
                  <p className="mt-1 text-[9.5px] leading-snug text-slate-600">
                    {proj.valorProjetado !== null
                      ? `Fonte: ${proj.fonte === "extrapolacao_trailing" ? "extrapolação trailing" : proj.fonte} · confiabilidade ${proj.confiabilidade ?? "—"} · intervalo ${pct(proj.estimativaVariacao.intervaloInferior)} a ${pct(proj.estimativaVariacao.intervaloSuperior)}`
                      : proj.estimativaVariacao.motivo}
                  </p>
                </div>
              ))}
            </div>
          </Secao>

          {/* ================= SEÇÃO 8 — Scenarios ================= */}
          <Secao titulo="Scenarios" subtitulo="Impacto por cenário macro — só o canal Selic tem sensibilidade calibrada hoje.">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {impactosCenario.map((r) => (
                <div key={r.cenario} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                  <p className="text-[11px] font-semibold text-slate-200">{ROTULO_CENARIO[r.cenario]}</p>
                  <p className="mt-1 text-[10.5px] text-slate-500">{r.premissas.selic}</p>
                  <p className={`mt-1.5 text-[11px] font-semibold ${r.selic.impacto === "positivo" ? "text-emerald-400" : r.selic.impacto === "negativo" ? "text-red-400" : "text-slate-500"}`}>
                    Selic: {r.selic.impacto ?? "não avaliado"}
                  </p>
                  <p className="mt-1 text-[9.5px] leading-snug text-slate-600">{r.selic.explicacao}</p>
                  <p className="mt-1.5 text-[9px] text-slate-700">IPCA/PIB/Dólar/Commodities: sem sensibilidade calibrada (ver scenario-engine.ts).</p>
                </div>
              ))}
            </div>
          </Secao>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {/* ================= SEÇÃO 9 — Portfolio Fit ================= */}
            <Secao titulo="Portfolio Fit" subtitulo="Esta empresa melhora minha carteira? — nunca só um número.">
              {fit ? (
                <div className="space-y-2">
                  <p className="font-mono text-[22px] font-bold text-slate-100">{fit.scoreEncaixe ?? "—"} <span className="text-[11px] font-normal text-slate-500">/ 100 ({fit.componentesDisponiveis}/{fit.componentesTotal} componentes)</span></p>
                  <div className="grid grid-cols-2 gap-2 text-[10.5px]">
                    {fit.componentes.map((c) => (
                      <div key={c.id}>
                        <p className="text-slate-400">{c.nome}: <span className="font-mono text-slate-200">{c.valor ?? "—"}</span></p>
                      </div>
                    ))}
                  </div>
                  {!posicaoAtual && <p className="mt-1 text-[9.5px] text-amber-500/80">Simulado com peso hipotético de 5% (empresa não detida hoje) — nunca uma recomendação de tamanho de posição.</p>}
                </div>
              ) : (
                <p className="text-[12px] text-slate-500">Sem Portfolio Fit calculável.</p>
              )}
            </Secao>

            {/* ================= SEÇÃO 10 — Wealth Impact ================= */}
            <Secao titulo="Wealth Impact" subtitulo="Como esta empresa influencia meu patrimônio.">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Participação atual</p>
                  <p className="font-mono text-[15px] font-bold text-slate-100">{posicaoAtual?.peso !== null && posicaoAtual?.peso !== undefined ? pct(posicaoAtual.peso) : "0% (não detida)"}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">CAGR real da carteira</p>
                  <p className="font-mono text-[15px] font-bold text-slate-100">{wealth?.cagr !== null && wealth?.cagr !== undefined ? pctSinal(wealth.cagr) : "—"}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Impacto esperado no CAGR</p>
                  <p className="font-mono text-[13px] font-bold text-slate-600">Dado ainda não disponível.</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-slate-500">Impacto esperado na meta</p>
                  <p className="font-mono text-[13px] font-bold text-slate-600">Dado ainda não disponível.</p>
                </div>
              </div>
              <p className="mt-2 text-[9.5px] text-slate-700">Wealth Engine calcula CAGR/retorno real da CARTEIRA INTEIRA — não existe motor de contribuição marginal por empresa hoje. Nunca estimado por aproximação.</p>
            </Secao>
          </div>

          {/* ================= SEÇÃO 11 — Replay ================= */}
          <Secao titulo="Replay" subtitulo="Timeline completa navegável — só eventos com fonte real (balanço, nota, Carry v1 histórico, tese, resultado observado).">
            <ReplayPlayback eventos={replay} />
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto border-l border-white/10 pl-3">
              {replay.map((e, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[15.5px] top-1 h-1.5 w-1.5 rounded-full bg-sky-400/70" />
                  <p className="text-[9px] uppercase tracking-wider text-slate-600">{fmtData(e.data)} · {e.tipo.replace(/_/g, " ")}</p>
                  <p className="mt-0.5 text-[11px] leading-snug text-slate-300">{e.explicacao}</p>
                </div>
              ))}
              {replay.length === 0 && <p className="text-[11px] text-slate-500">Sem eventos registrados ainda.</p>}
            </div>
            {comunicadosRaw && (comunicadosRaw as ComunicadoRow[]).length > 0 && (
              <div className="mt-3 border-t border-white/5 pt-2.5">
                <p className="text-[9px] uppercase tracking-wider text-slate-600">Comunicados oficiais (CVM/IPE) — fonte primária</p>
                <div className="mt-1.5 space-y-1">
                  {(comunicadosRaw as ComunicadoRow[]).map((c, i) => (
                    <a key={i} href={c.link} target="_blank" rel="noopener noreferrer" className="flex items-baseline justify-between gap-3 rounded-lg bg-white/[0.02] px-2.5 py-1 text-[11px] hover:bg-white/[0.05]">
                      <span className="min-w-0 truncate text-slate-300">{c.assunto}</span>
                      <span className="shrink-0 text-[9.5px] text-slate-600">{fmtData(c.data_entrega)}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </Secao>

          {/* ================= SEÇÃO 12 — Por que o sistema acredita nisso? ================= */}
          <Secao titulo="Por que o sistema acredita nisso?" subtitulo="Painel premium — tudo consumindo o Foundation.">
            {decision ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Probabilidade</p><p className="mt-1 text-[11px] text-slate-300">{decision.probability?.explicacao ?? "Sem decisões registradas o suficiente no Diário."}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Confiança (convicção)</p><p className="mt-1 text-[11px] text-slate-300">{decision.conviccao}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Auditoria (FDIE)</p><p className="mt-1 text-[11px] text-slate-300">{decision.fdie.ok} ok · {decision.fdie.alerta} alerta · {decision.fdie.critico} crítico</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Premissas / Hipóteses</p><p className="mt-1 text-[11px] text-slate-500">{perfilTese && perfilTese.premissas.length + perfilTese.hipoteses.length > 0 ? "Ver estrutura da tese." : "Estrutura qualitativa (migração 022) ainda não aplicada — corte honesto."}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Limitações</p><p className="mt-1 text-[11px] text-slate-500">{decision.warnings.length > 0 ? decision.warnings.join(" ") : "Nenhuma limitação registrada."}</p></div>
                <div><p className="text-[9px] uppercase tracking-wider text-slate-500">Origem dos dados</p><p className="mt-1 text-[11px] text-slate-500">Gerado em {fmtData(decision.generatedAt)} · versão {decision.version} · {decision.explanation.avisos.length} aviso(s) do motor</p></div>
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">Sem Decision Object calculável.</p>
            )}
          </Secao>

          {/* ================= SEÇÃO 13 — Decision Panel ================= */}
          <Secao titulo="Decision Panel">
            {painelDecisao ? (
              <div className="rounded-[14px] border border-white/5 bg-white/[0.02] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${COR_URGENCIA[painelDecisao.urgencia]}`}>{ROTULO_URGENCIA[painelDecisao.urgencia]}</span>
                  <span className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-[12px] font-semibold text-sky-200">{ACAO_PAINEL[painelDecisao.urgencia]}</span>
                </div>
                <p className="mt-2 text-[12.5px] leading-relaxed text-slate-200">{painelDecisao.motivo}</p>
                <p className="mt-2 text-[11px] text-slate-500">{decision ? impactoEsperadoTexto(decision) : ""}</p>
                <p className="mt-1 text-[11px] text-slate-500">Probabilidade: {decision?.probability?.probabilidade !== null && decision?.probability?.probabilidade !== undefined ? pct(decision.probability.probabilidade, 0) : "—"} · Evidências: {decision?.evidences.length ?? 0}</p>
              </div>
            ) : (
              <p className="text-[12px] text-slate-500">Sem dado suficiente para um veredito hoje.</p>
            )}
          </Secao>
        </>
      )}
    </Shell>
  );
}
