import type { EntradaEvidenciaEnriquecida } from "./memory-layer";

/**
 * COLETOR 9 (parte Carry) — Bloco 2, Sprint 2.3.
 *
 * Fonte já real e já persistida: `carry_score` (migração 009), gravada
 * diariamente pelo cron de avaliação de teses (/api/teses/avaliar). Este
 * arquivo só compara pontos consecutivos e emite Evidence — não recalcula
 * Carry, não lê pesos, não toca em `carry/*` (Foundation congelado).
 *
 * Corte honesto de categoria: `EvidenciaCategoria` (Foundation congelado)
 * não tem valor dedicado para "Carry" — decisão de estender o enum
 * (precedente: "custos" foi adicionado assim no Foundation v4) fica para o
 * Carlos ratificar explicitamente antes de eu mexer em `evidence.ts`,
 * especialmente porque a spec desta sprint pede em letras maiúsculas "NÃO
 * ALTERAR CARRY" — mesmo sendo só uma categoria de evidência SOBRE Carry,
 * não uma mudança na fórmula, preferi não decidir isso sozinho. Por ora,
 * categoria "outro" (mesmo padrão já usado para lucro em
 * memory-layer-resultados.ts).
 */

export type CarryScoreRow = {
  ticker: string;
  data: string;
  carry_real: number | null;
};

const LIMIAR_CARRY = 0.01; // 1 ponto percentual — mesmo limiar de LIMIARES_TIMELINE.carry (decision-timeline.ts)

export function emitirEvidenciasCarry(porTickerAscendente: Map<string, CarryScoreRow[]>): EntradaEvidenciaEnriquecida[] {
  const saida: EntradaEvidenciaEnriquecida[] = [];
  for (const serie of porTickerAscendente.values()) {
    if (serie.length < 2) continue;
    const atual = serie[serie.length - 1];
    const anterior = serie[serie.length - 2];
    if (anterior.carry_real === null || atual.carry_real === null) continue;
    const diff = atual.carry_real - anterior.carry_real;
    if (Math.abs(diff) < LIMIAR_CARRY) continue;
    const pctAnterior = (anterior.carry_real * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    const pctAtual = (atual.carry_real * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
    saida.push({
      ticker: atual.ticker,
      categoria: "outro",
      origem: "Carry Engine (carry_score)",
      data: atual.data,
      pesoInformativo: diff > 0 ? 1 : -1,
      confiabilidade: "alta",
      descricao: `Carry real mudou de IPCA + ${pctAnterior}% para IPCA + ${pctAtual}% a.a. (${anterior.data} → ${atual.data}).`,
      payload: { ticker: atual.ticker, anterior: anterior.carry_real, atual: atual.carry_real, dataAnterior: anterior.data, dataAtual: atual.data },
      subcategoria: "Financeiro",
      titulo: `Carry ${diff > 0 ? "aumentou" : "caiu"} (${atual.data})`,
      urlOficial: null,
      documentoOficial: null,
    });
  }
  return saida;
}
