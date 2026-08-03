import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularScore } from "@/lib/score";
import { lucroLTM, roicMedia4Tri } from "@/lib/fundamentos";
import { carryVigente } from "@/lib/carry";

/**
 * Cálculo do RADAR — prévia das 40 empresas pelas réguas versionadas v1.
 * Compartilhado entre a página /radar e o Decision Center (zero duplicação).
 * Prévia calculada na hora ≠ nota oficial (imutável, só para quem tem tese).
 */

export type LinhaRadar = {
  ticker: string;
  nome: string;
  setor: string | null;
  temTese: boolean;
  nota: number;
  confianca: "alta" | "media" | "baixa";
  componentes: number;
  roic4: number | null;
  margem: number | null;
  caixaLiquido: boolean;
  alav: number | null;
  pl: number | null;
  ey: number | null;
  carryReal: number | null;
  carryConfianca: "alta" | "media" | "baixa";
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

export async function calcularRadar(sb: SupabaseClient): Promise<LinhaRadar[]> {
  const [{ data: empresasRaw }, { data: fundsRaw }, { data: precosRaw }, { data: acoesRaw }, { data: tesesRaw }] =
    await Promise.all([
      sb.from("empresas").select("ticker, nome, setor").eq("ativo", true),
      sb
        .from("fundamentos")
        .select("ticker, competencia, fonte, receita_liquida, lucro_liquido, margem_liquida, roic, divida_liquida, patrimonio_liquido")
        .order("competencia", { ascending: false }),
      sb
        .from("precos_diarios")
        .select("ticker, data, fechamento, market_cap")
        .order("data", { ascending: false })
        .limit(300),
      sb.from("acoes_totais").select("ticker, qtd_acoes"),
      sb.from("teses").select("ticker").eq("ativa", true),
    ]);

  const empresas = (empresasRaw as { ticker: string; nome: string; setor: string | null }[]) ?? [];
  const fundsPorTicker = new Map<string, Fund[]>();
  for (const f of (fundsRaw as Fund[]) ?? []) {
    const arr = fundsPorTicker.get(f.ticker) ?? [];
    arr.push(f); // já ordenado do mais recente para o mais antigo
    fundsPorTicker.set(f.ticker, arr);
  }
  const precoPorTicker = new Map<string, { fechamento: number; market_cap: number | null }>();
  for (const p of (precosRaw as { ticker: string; fechamento: number; market_cap: number | null }[]) ?? []) {
    if (!precoPorTicker.has(p.ticker)) precoPorTicker.set(p.ticker, p);
  }
  const acoesPorTicker = new Map(
    (((acoesRaw as { ticker: string; qtd_acoes: number }[]) ?? [])).map((a) => [a.ticker, Number(a.qtd_acoes)])
  );
  const comTese = new Set((((tesesRaw as { ticker: string }[]) ?? [])).map((t) => t.ticker));

  return empresas
    .map((e) => {
      const funds = fundsPorTicker.get(e.ticker) ?? [];
      if (funds.length === 0) return null;
      const rec = funds[0];

      const preco = precoPorTicker.get(e.ticker);
      const ehUnit = e.ticker.endsWith("11");
      const qtd = acoesPorTicker.get(e.ticker);
      const mcOficial = !ehUnit && qtd && preco?.fechamento ? qtd * Number(preco.fechamento) : null;
      const market_cap = mcOficial ?? (preco?.market_cap ? Number(preco.market_cap) : null);

      const ltm = lucroLTM(funds);
      const margensTri = funds
        .filter((f) => f.fonte === "cvm_itr" && f.margem_liquida !== null)
        .slice(0, 6)
        .map((f) => Number(f.margem_liquida));

      const previa = calcularScore({
        roic: rec.roic !== null ? Number(rec.roic) : null,
        margem_liquida: rec.margem_liquida !== null ? Number(rec.margem_liquida) : null,
        divida_liquida: rec.divida_liquida !== null ? Number(rec.divida_liquida) : null,
        patrimonio_liquido: rec.patrimonio_liquido !== null ? Number(rec.patrimonio_liquido) : null,
        lucro_ltm: ltm,
        market_cap,
        margens_trimestrais: margensTri,
      });

      const roic4 = roicMedia4Tri(funds);
      const ey = ltm !== null && market_cap && market_cap > 0 ? ltm / market_cap : null;
      const pl = ey !== null && ey > 0 ? 1 / ey : null;
      const alav =
        rec.divida_liquida !== null && rec.patrimonio_liquido !== null && Number(rec.patrimonio_liquido) > 0
          ? Number(rec.divida_liquida) / Number(rec.patrimonio_liquido)
          : null;

      // crescimento anual de receita (DFP 2025 vs 2024) p/ o Carry
      const dfps = funds
        .filter((f) => f.fonte === "cvm_dfp")
        .sort((a, b) => b.competencia.localeCompare(a.competencia));
      const crescReceita =
        dfps.length >= 2 &&
        dfps[0].receita_liquida !== null &&
        dfps[1].receita_liquida !== null &&
        Number(dfps[1].receita_liquida) > 0
          ? Number(dfps[0].receita_liquida) / Number(dfps[1].receita_liquida) - 1
          : null;

      const desvioMargens =
        margensTri.length >= 3
          ? Math.sqrt(
              margensTri.reduce((acc, m) => {
                const med = margensTri.reduce((x, y) => x + y, 0) / margensTri.length;
                return acc + (m - med) ** 2;
              }, 0) / margensTri.length
            )
          : null;
      const ehFinanceira = rec.roic === null && rec.divida_liquida === null;
      const carry = carryVigente().calcular({
        lucroLtm: ltm,
        marketCap: market_cap,
        roic4: roicMedia4Tri(funds),
        margensDesvio: desvioMargens,
        caixaLiquido: rec.divida_liquida !== null ? Number(rec.divida_liquida) <= 0 : null,
        alavancagem: alav,
        crescReceitaAnual: crescReceita,
        ehFinanceira,
      });

      return {
        ...e,
        temTese: comTese.has(e.ticker),
        nota: previa.score_final,
        confianca: previa.confianca,
        componentes: previa.decomposicao.length,
        roic4,
        margem: rec.margem_liquida !== null ? Number(rec.margem_liquida) : null,
        caixaLiquido: rec.divida_liquida !== null && Number(rec.divida_liquida) <= 0,
        alav,
        pl,
        ey,
        carryReal: carry.carryReal,
        carryConfianca: carry.confianca,
      };
    })
    .filter((l): l is LinhaRadar => l !== null)
    .sort((a, b) => b.nota - a.nota);
}

/** Candidatas a nova tese: sem tese, confiança razoável, nota com 3+ réguas. */
export function candidatas(linhas: LinhaRadar[], n = 3): LinhaRadar[] {
  return linhas
    .filter((l) => !l.temTese && l.confianca !== "baixa" && l.componentes >= 3)
    .slice(0, n);
}
