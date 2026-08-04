import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularMasterDecision, type EntradaMasterEngine } from "@/lib/master-engine";
import { montarDecision, type Decision } from "@/lib/decision-object";
import { lucroLTM, ltmCampo, roicMedia4Tri } from "@/lib/fundamentos";
import { ehModeloFinanceiro, indicadorPermitido, modeloDe } from "@/lib/setores";
import { marketCapSelecionado } from "@/lib/marketcap";
import type { EmpresaAuditavel } from "@/lib/auditoria";
import type { CarryEntrada } from "@/lib/carry/types";
import type { LinhaCompounder } from "@/lib/compounder-dados";
import type { LinhaTechnical } from "@/lib/technical-dados";

/**
 * DECISION DADOS (Bloco 2 — Sprint 2.1, Meu Dash).
 *
 * Primeiro call site de PRODUÇÃO do Master Decision Engine/Decision Object
 * (Foundation Bloco 1 + v3.1) — até agora só existiam em teste (ver
 * `master-engine.ts`, comentário de cabeçalho, "PENDÊNCIA EXPLÍCITA do
 * Bloco 2"). Escopo desta rodada, decidido com o Carlos: só o Meu Dash lê
 * daqui. `radar.ts`, `/api/teses/avaliar` e `/comparar` continuam com o
 * motor de nota antigo (`calcularScorePorModelo`) e Confluence v1
 * (`calcularConfluencia` via `confluencia-dados.ts`) — migrá-los é
 * pendência registrada para um sprint futuro, não desta rodada (mexe no
 * caminho que grava a nota oficial imutável via cron noturno).
 *
 * Consequência visível e aceita: o Confluence Score mostrado no Meu Dash
 * (v2, 8 componentes, via Master Engine) pode divergir do Confluence
 * mostrado em `/carteira` (v1, 4 componentes) para o mesmo ticker, até essa
 * outra tela ser migrada também.
 *
 * Monta `EntradaMasterEngine` reaproveitando EXATAMENTE a mesma lógica de
 * leitura já usada em `radar.ts` (roic4/margensDesvio/caixaLiquido/
 * alavancagem/crescReceita/ehFinanceira/marketCap) e em
 * `/api/teses/avaliar` + `/comparar` (dividendosJcpLtm/caixaOperacionalLtm/
 * capexLtm via `fluxo_caixa`) — nenhuma conta nova, só centralizada aqui
 * pela primeira vez em vez de duplicada pela 4ª.
 */

export type DecisionsResultado = {
  porTicker: Map<string, Decision>;
  /** tickers pedidos que não entraram (sem fundamentos suficientes) — corte honesto, nunca escondido */
  semDadoSuficiente: string[];
};

type Fund = {
  ticker: string;
  competencia: string;
  fonte: string;
  receita_liquida: number | null;
  lucro_liquido: number | null;
  margem_bruta: number | null;
  margem_liquida: number | null;
  roic: number | null;
  divida_liquida: number | null;
  patrimonio_liquido: number | null;
  caixa: number | null;
};

type Fluxo = {
  ticker: string;
  competencia: string;
  fonte: string;
  caixa_operacional: number | null;
  capex: number | null;
  dividendos_jcp: number | null;
};

async function buscarEntradasMasterEngine(
  sb: SupabaseClient,
  tickers: string[]
): Promise<{ entrada: EntradaMasterEngine; setor: string | null; empresa: string }[]> {
  const [{ data: empresasRaw }, { data: fundsRaw }, { data: precosRaw }, { data: acoesRaw }, { data: fluxoRaw }] =
    await Promise.all([
      sb.from("empresas").select("ticker, nome, setor").eq("ativo", true),
      sb
        .from("fundamentos")
        .select(
          "ticker, competencia, fonte, receita_liquida, lucro_liquido, margem_bruta, margem_liquida, roic, divida_liquida, patrimonio_liquido, caixa"
        )
        .order("competencia", { ascending: false }),
      sb.from("precos_diarios").select("ticker, data, fechamento, market_cap").order("data", { ascending: false }).limit(300),
      sb.from("acoes_totais").select("ticker, qtd_acoes"),
      sb
        .from("fluxo_caixa")
        .select("ticker, competencia, fonte, caixa_operacional, capex, dividendos_jcp")
        .order("competencia", { ascending: false }),
    ]);

  const empresas = ((empresasRaw as { ticker: string; nome: string; setor: string | null }[]) ?? []).filter((e) =>
    tickers.includes(e.ticker)
  );

  const fundsPorTicker = new Map<string, Fund[]>();
  for (const f of (fundsRaw as Fund[]) ?? []) {
    const arr = fundsPorTicker.get(f.ticker) ?? [];
    arr.push(f);
    fundsPorTicker.set(f.ticker, arr);
  }
  const fluxoPorTicker = new Map<string, Fluxo[]>();
  for (const f of (fluxoRaw as Fluxo[]) ?? []) {
    const arr = fluxoPorTicker.get(f.ticker) ?? [];
    arr.push(f);
    fluxoPorTicker.set(f.ticker, arr);
  }
  const precoPorTicker = new Map<string, { fechamento: number; market_cap: number | null }>();
  for (const p of (precosRaw as { ticker: string; fechamento: number; market_cap: number | null }[]) ?? []) {
    if (!precoPorTicker.has(p.ticker)) precoPorTicker.set(p.ticker, p);
  }
  const acoesPorTicker = new Map(
    (((acoesRaw as { ticker: string; qtd_acoes: number }[]) ?? [])).map((a) => [a.ticker, Number(a.qtd_acoes)])
  );

  const saida: { entrada: EntradaMasterEngine; setor: string | null; empresa: string }[] = [];

  for (const e of empresas) {
    const funds = fundsPorTicker.get(e.ticker) ?? [];
    if (funds.length === 0) continue; // corte honesto — sem fundamentos, sem Decision
    const fluxo = fluxoPorTicker.get(e.ticker) ?? [];
    const rec = funds[0];

    const preco = precoPorTicker.get(e.ticker);
    const ehUnit = e.ticker.endsWith("11");
    const qtd = acoesPorTicker.get(e.ticker);
    const marketCap = marketCapSelecionado({
      qtdAcoes: qtd,
      fechamento: preco?.fechamento,
      marketCapMercado: preco?.market_cap,
      ehUnit,
    }).valor;

    const ltm = lucroLTM(funds);
    const margensTri = funds
      .filter((f) => f.fonte === "cvm_itr" && f.margem_liquida !== null)
      .slice(0, 6)
      .map((f) => Number(f.margem_liquida));
    const desvioMargens =
      margensTri.length >= 3
        ? Math.sqrt(
            margensTri.reduce((acc, m) => {
              const med = margensTri.reduce((x, y) => x + y, 0) / margensTri.length;
              return acc + (m - med) ** 2;
            }, 0) / margensTri.length
          )
        : null;

    const roic4 = indicadorPermitido(e.ticker, "roic") ? roicMedia4Tri(funds) : null;
    const ehFinanceira = ehModeloFinanceiro(e.ticker);
    const caixaLiquido =
      indicadorPermitido(e.ticker, "divida_liquida") && rec.divida_liquida !== null ? Number(rec.divida_liquida) <= 0 : null;
    const alavancagem =
      indicadorPermitido(e.ticker, "divida_liquida") &&
      rec.divida_liquida !== null &&
      rec.patrimonio_liquido !== null &&
      Number(rec.patrimonio_liquido) > 0
        ? Number(rec.divida_liquida) / Number(rec.patrimonio_liquido)
        : null;

    const dfps = funds.filter((f) => f.fonte === "cvm_dfp").sort((a, b) => b.competencia.localeCompare(a.competencia));
    const crescReceita =
      dfps.length >= 2 && dfps[0].receita_liquida !== null && dfps[1].receita_liquida !== null && Number(dfps[1].receita_liquida) > 0
        ? Number(dfps[0].receita_liquida) / Number(dfps[1].receita_liquida) - 1
        : null;

    const dividendosJcpLtm = fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.dividendos_jcp) : null;
    const caixaOperacionalLtm = fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.caixa_operacional) : null;
    const capexLtm = fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.capex) : null;

    const carryEntrada: CarryEntrada = {
      lucroLtm: ltm,
      marketCap,
      roic4,
      margensDesvio: desvioMargens,
      caixaLiquido,
      alavancagem,
      crescReceitaAnual: crescReceita,
      ehFinanceira,
      dividendosJcpLtm,
      caixaOperacionalLtm,
      capexLtm,
    };

    const auditoria: EmpresaAuditavel = {
      ticker: e.ticker,
      modelo: modeloDe(e.ticker),
      cotacao: preco?.fechamento ?? null,
      qtdAcoes: qtd ?? null,
      marketCapBruto: preco?.market_cap ?? null,
      receita: rec.receita_liquida !== null ? Number(rec.receita_liquida) : null,
      lucro: rec.lucro_liquido !== null ? Number(rec.lucro_liquido) : null,
      margemBruta: rec.margem_bruta !== null ? Number(rec.margem_bruta) : null,
      margemLiquida: rec.margem_liquida !== null ? Number(rec.margem_liquida) : null,
      roic: rec.roic !== null ? Number(rec.roic) : null,
      dividaLiquida: rec.divida_liquida !== null ? Number(rec.divida_liquida) : null,
      caixa: rec.caixa !== null ? Number(rec.caixa) : null,
    };

    saida.push({
      entrada: {
        ticker: e.ticker,
        auditoria,
        fundamentosScore: null, // preenchido por quem chama (junta com Radar/Compounder/Technical fora daqui)
        fundamentosComponentes: 0,
        compounderScore: null,
        carryEntrada,
        technicalScore: null,
      },
      setor: e.setor,
      empresa: e.nome,
    });
  }

  return saida;
}

/**
 * Monta `Decision` (Foundation, via Master Engine) para os tickers pedidos.
 * `fundamentosPorTicker` reaproveita o Radar já calculado por quem chama
 * (nota + nº de componentes) — não recalcula réguas fundamentalistas aqui,
 * só as entradas de FDIE/Carry que o Radar não expõe.
 */
export async function montarDecisions(
  sb: SupabaseClient,
  tickers: string[],
  fundamentosPorTicker: Map<string, { nota: number; componentes: number }>,
  compounderPorTicker: Map<string, LinhaCompounder>,
  technicalPorTicker: Map<string, LinhaTechnical>,
  generatedAt: string
): Promise<DecisionsResultado> {
  if (tickers.length === 0) return { porTicker: new Map(), semDadoSuficiente: [] };

  const base = await buscarEntradasMasterEngine(sb, tickers);
  const porTicker = new Map<string, Decision>();
  const vistos = new Set(base.map((b) => b.entrada.ticker));
  const semDadoSuficiente = tickers.filter((t) => !vistos.has(t));

  for (const { entrada, setor, empresa } of base) {
    const fund = fundamentosPorTicker.get(entrada.ticker);
    const comp = compounderPorTicker.get(entrada.ticker);
    const tec = technicalPorTicker.get(entrada.ticker);

    const entradaCompleta: EntradaMasterEngine = {
      ...entrada,
      fundamentosScore: fund?.nota ?? null,
      fundamentosComponentes: fund?.componentes ?? 0,
      compounderScore: comp?.resultado.score ?? null,
      technicalScore: tec?.resultado.score ?? null,
    };

    const resultado = calcularMasterDecision(entradaCompleta);
    const decision = montarDecision({ resultado, empresa, setor }, generatedAt);
    porTicker.set(entrada.ticker, decision);
  }

  return { porTicker, semDadoSuficiente };
}
