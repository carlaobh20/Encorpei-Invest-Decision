import { projetarIndicador, type ProjecaoIndicador } from "./forecast-engine";

/**
 * FORECAST — EMPRESA (Bloco 2 — Sprint 2.2, Empresas, Seção 7).
 *
 * `forecast-engine.ts` (Foundation v4) já implementa a extrapolação
 * trailing como função pura — este arquivo só monta as 5 séries que a
 * spec pediu (Receita/Lucro/Margem/ROIC/Carry esperados) a partir de dado
 * já coletado, e chama o motor. Nenhuma conta de projeção acontece aqui.
 *
 * Fontes reais usadas:
 *  - Receita/Lucro/Margem/ROIC: `fundamentos` (DFP anual, já usado em todo
 *    o resto do sistema para série anual — mesmo padrão de `radar.ts`).
 *  - Carry: `carry_score` (migração 009), histórico DIÁRIO real do Carry
 *    v1 — mesma fonte usada no Replay (`thesis-replay-dados.ts`).
 *
 * Simplificação registrada: períodos sem valor (null) são DESCARTADOS
 * antes de montar a série, não interpolados — isso pode fazer o motor
 * comparar dois períodos que não são estritamente consecutivos no
 * calendário como se fossem (mesma aproximação que `radar.ts`/`compounder-
 * dados.ts` já fazem ao ignorar competência com dado ausente). Não inventa
 * valor nenhum; só um viés pequeno de "taxa de variação" quando há buraco
 * na série, documentado aqui.
 */

export type FundamentoAnual = {
  competencia: string;
  receita_liquida: number | null;
  lucro_liquido: number | null;
  margem_liquida: number | null;
  roic: number | null;
};

export type CarryHistorico = { data: string; carryReal: number | null };

export type ForecastEmpresa = {
  receita: ProjecaoIndicador;
  lucro: ProjecaoIndicador;
  margem: ProjecaoIndicador;
  roic: ProjecaoIndicador;
  carry: ProjecaoIndicador;
};

function montarSerie(pontos: { periodo: string; valor: number | null }[]) {
  return pontos.filter((p): p is { periodo: string; valor: number } => p.valor !== null);
}

/**
 * `fundamentosAscendente`/`carryAscendente` já vêm ordenados do mais
 * antigo para o mais recente — quem chama busca e ordena, esta função só
 * monta as séries e delega ao Forecast Engine.
 */
export function montarForecastEmpresa(fundamentosAscendente: FundamentoAnual[], carryAscendente: CarryHistorico[]): ForecastEmpresa {
  const receitaSerie = montarSerie(fundamentosAscendente.map((f) => ({ periodo: f.competencia, valor: f.receita_liquida })));
  const lucroSerie = montarSerie(fundamentosAscendente.map((f) => ({ periodo: f.competencia, valor: f.lucro_liquido })));
  const margemSerie = montarSerie(fundamentosAscendente.map((f) => ({ periodo: f.competencia, valor: f.margem_liquida })));
  const roicSerie = montarSerie(fundamentosAscendente.map((f) => ({ periodo: f.competencia, valor: f.roic })));
  const carrySerie = montarSerie(carryAscendente.map((c) => ({ periodo: c.data, valor: c.carryReal })));

  // janela reduzida (2, contra o padrão 4 do motor) nas séries ANUAIS — o
  // backfill de CVM cobre poucos anos ainda (~2023-2025); com o padrão, a
  // projeção sairia "indisponível" quase sempre por falta de amostra, não
  // por falta de sinal. Documentado aqui, não escondido — a janela menor
  // é uma escolha de UX (mostrar projeção com confiabilidade mais baixa em
  // vez de sempre "—"), não uma calibração do motor em si.
  return {
    receita: projetarIndicador("Receita líquida (anual)", receitaSerie, { janelaTrailing: 2 }),
    lucro: projetarIndicador("Lucro líquido (anual)", lucroSerie, { janelaTrailing: 2 }),
    margem: projetarIndicador("Margem líquida (anual)", margemSerie, { janelaTrailing: 2 }),
    roic: projetarIndicador("ROIC (anual)", roicSerie, { janelaTrailing: 2 }),
    carry: projetarIndicador("Carry real (diário)", carrySerie, { janelaTrailing: 10 }),
  };
}
