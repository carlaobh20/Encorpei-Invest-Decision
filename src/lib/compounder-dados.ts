import type { SupabaseClient } from "@supabase/supabase-js";
import { ltmCampo, lucroLTM, roicMedia4Tri } from "@/lib/fundamentos";
import { calcularCompounder } from "@/lib/compounder/v1";
import { sensibilidadeJuros, type CategoriaSensibilidade } from "@/lib/compounder/sensibilidade-juros";
import { ehModeloFinanceiro, indicadorPermitido, modeloDe, type ModeloAnalise } from "@/lib/setores";
import { marketCapSelecionado } from "@/lib/marketcap";
import type { CompounderResultado } from "@/lib/compounder/types";

/**
 * Monta a entrada do Compounder Engine e roda o cálculo, empresa por
 * empresa — mesmo padrão de src/lib/radar.ts (fetch + assemble aqui,
 * cálculo puro e testável em src/lib/compounder/). Nada de duplicar
 * lógica: mesma leitura de fundamentos/fluxo de caixa que o resto do
 * sistema já usa.
 */

export type LinhaCompounder = {
  ticker: string;
  nome: string;
  modelo: ModeloAnalise | null;
  resultado: CompounderResultado;
  sensibilidadeSelic: { categoria: CategoriaSensibilidade | null; explicacao: string };
  marketCap: number | null;
  /** dívida líquida / patrimônio — já calculado aqui para sensibilidadeSelic; exposto para o Meu Dash (Foundation v4, Portfolio Fit) reaproveitar sem recalcular */
  alavancagem: number | null;
  /** 1 - payout (dividendos+JCP / lucro LTM) — idem, exposto para reaproveitamento externo */
  retencao: number | null;
};

type Fund = {
  ticker: string;
  competencia: string;
  fonte: string;
  receita_liquida: number | null;
  lucro_liquido: number | null;
  margem_liquida: number | null;
  roic: number | null;
  divida_liquida: number | null;
  patrimonio_liquido: number | null;
};

type Fluxo = {
  ticker: string;
  competencia: string;
  fonte: string;
  caixa_operacional: number | null;
  capex: number | null;
  dividendos_jcp: number | null;
  recompras: number | null;
};

export async function calcularCompounders(sb: SupabaseClient): Promise<LinhaCompounder[]> {
  const [{ data: empresasRaw }, { data: fundsRaw }, { data: precosRaw }, { data: acoesRaw }, { data: fluxoRaw }] =
    await Promise.all([
      sb.from("empresas").select("ticker, nome").eq("ativo", true),
      sb
        .from("fundamentos")
        .select(
          "ticker, competencia, fonte, receita_liquida, lucro_liquido, margem_liquida, roic, divida_liquida, patrimonio_liquido"
        )
        .order("competencia", { ascending: false }),
      sb.from("precos_diarios").select("ticker, data, fechamento, market_cap").order("data", { ascending: false }),
      sb.from("acoes_totais").select("ticker, qtd_acoes"),
      sb
        .from("fluxo_caixa")
        .select("ticker, competencia, fonte, caixa_operacional, capex, dividendos_jcp, recompras")
        .order("competencia", { ascending: false }),
    ]);

  const empresas = (empresasRaw as { ticker: string; nome: string }[]) ?? [];

  const fundsPorTicker = new Map<string, Fund[]>();
  for (const f of (fundsRaw as Fund[]) ?? []) {
    const arr = fundsPorTicker.get(f.ticker) ?? [];
    arr.push(f);
    fundsPorTicker.set(f.ticker, arr);
  }

  const fluxoPorTicker = new Map<string, Fluxo[]>();
  const vistoFluxo = new Set<string>();
  for (const f of (fluxoRaw as Fluxo[]) ?? []) {
    const chave = `${f.ticker}:${f.competencia}:${f.fonte}`;
    if (vistoFluxo.has(chave)) continue; // dedup defensivo (unique real inclui "inicio")
    vistoFluxo.add(chave);
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

  const linhas: LinhaCompounder[] = [];

  for (const e of empresas) {
    const funds = fundsPorTicker.get(e.ticker) ?? [];
    const fluxo = fluxoPorTicker.get(e.ticker) ?? [];
    if (funds.length === 0) continue;

    const preco = precoPorTicker.get(e.ticker);
    const qtd = acoesPorTicker.get(e.ticker);
    const ehUnit = e.ticker.endsWith("11");
    // auditoria de 03/08/2026: mesma correção do radar.ts — não confia cego
    // em qtd_acoes × fechamento quando diverge muito do valor ao vivo da
    // fonte (acoes_totais pode estar desatualizado). Ver src/lib/marketcap.ts.
    const marketCap = marketCapSelecionado({
      qtdAcoes: qtd,
      fechamento: preco?.fechamento,
      marketCapMercado: preco?.market_cap,
      ehUnit,
    }).valor;

    const dfps = funds
      .filter((f) => f.fonte === "cvm_dfp")
      .sort((a, b) => b.competencia.localeCompare(a.competencia));
    const receitaAnoAtual = dfps[0]?.receita_liquida !== null && dfps[0] ? Number(dfps[0].receita_liquida) : null;
    const receitaAnoAnterior = dfps[1]?.receita_liquida !== null && dfps[1] ? Number(dfps[1].receita_liquida) : null;
    const lucroAnoAtual = dfps[0]?.lucro_liquido !== null && dfps[0] ? Number(dfps[0].lucro_liquido) : null;
    const lucroAnoAnterior = dfps[1]?.lucro_liquido !== null && dfps[1] ? Number(dfps[1].lucro_liquido) : null;

    const rec = funds[0];
    // Sector Intelligence (auditoria de 03/08/2026): dirigido por MODELO, não
    // por dado bruto — banco/seguradora nunca entra no ROIC do Compounder,
    // independente de o campo estar preenchido por acaso naquele trimestre.
    const roic4tri = indicadorPermitido(e.ticker, "roic") ? roicMedia4Tri(funds) : null;
    const lucroLtm = lucroLTM(funds);
    const ehFinanceira = ehModeloFinanceiro(e.ticker);

    const margensTrimestrais = funds
      .filter((f) => f.fonte === "cvm_itr" && f.margem_liquida !== null)
      .slice(0, 6)
      .map((f) => Number(f.margem_liquida));

    const dividendosJcpLtm = fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.dividendos_jcp) : null;
    const caixaOperacionalLtm = fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.caixa_operacional) : null;
    const capexLtm = fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.capex) : null;
    const recomprasLtm = fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.recompras) : null;

    const resultado = calcularCompounder({
      ticker: e.ticker,
      receitaAnoAtual,
      receitaAnoAnterior,
      lucroAnoAtual,
      lucroAnoAnterior,
      roic4tri,
      lucroLtm,
      dividendosJcpLtm,
      caixaOperacionalLtm,
      capexLtm,
      marketCap,
      margensTrimestrais,
      recomprasLtm,
      ehFinanceira,
    });

    const alavancagem =
      indicadorPermitido(e.ticker, "divida_liquida") &&
      rec.divida_liquida !== null &&
      rec.patrimonio_liquido !== null &&
      Number(rec.patrimonio_liquido) > 0
        ? Number(rec.divida_liquida) / Number(rec.patrimonio_liquido)
        : null;
    const retencaoComp = resultado.componentes.find((c) => c.id === "reinvestimento");
    const payoutLtm =
      lucroLtm !== null && lucroLtm > 0 && dividendosJcpLtm !== null
        ? Math.min(Math.max(Math.abs(dividendosJcpLtm) / lucroLtm, 0), 1)
        : null;
    const retencao = payoutLtm !== null ? 1 - payoutLtm : null;
    void retencaoComp;

    const sensibilidadeSelic = sensibilidadeJuros({
      alavancagem,
      retencao,
      modelo: modeloDe(e.ticker),
    });

    linhas.push({
      ticker: e.ticker,
      nome: e.nome,
      modelo: modeloDe(e.ticker),
      resultado,
      sensibilidadeSelic,
      marketCap,
      alavancagem,
      retencao,
    });
  }

  return linhas.sort((a, b) => (b.resultado.score ?? -1) - (a.resultado.score ?? -1));
}
