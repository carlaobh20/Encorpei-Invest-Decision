import type { EntradaEvidenciaEnriquecida } from "./memory-layer";
import type { EvidenciaCategoria } from "./evidence";

/**
 * COLETOR 9 — RESULTADOS (Bloco 2, Sprint 2.3).
 *
 * A coleta em si já existe e já roda (tools/backfill_cvm.py, cron dias
 * úteis via .github/workflows/backfill-cvm.yml, grava fundamentos DFP/ITR
 * já tratados). Este arquivo compara duas competências consecutivas e
 * emite Evidence para cada indicador que mudou — mesmo espírito de
 * `detectarNovoBalanco`/`detectarMudancaNota` (decision-timeline.ts), mas
 * aplicado aos 4 indicadores fundamentalistas, que não tinham detector
 * próprio ainda.
 *
 * Corte honesto de categoria: `EvidenciaCategoria` (Foundation congelado)
 * já tem "receita", "margem" e "roic" — mapeamento direto, sem extensão.
 * "Lucro" NÃO tem categoria dedicada no enum congelado; em vez de estender
 * o enum por conta própria nesta sprint (decisão registrada para o Carlos
 * ratificar, ver ENTREGA), o lucro líquido é registrado como "outro",
 * mantendo o dado real e a comparação real — só a granularidade da
 * categoria fica mais grosseira até essa decisão ser tomada.
 *
 * FCF (fluxo de caixa livre) e Carry ficam FORA deste emissor — Carry tem
 * emissor próprio (fonte diferente: `carry_score`, migração 009); FCF fica
 * como pendência explícita (Sprint 2.3 Fase B), sem fonte de série
 * comparável já isolada neste sprint.
 */

export type FundamentoAnualRow = {
  competencia: string;
  ticker: string;
  receita_liquida: number | null;
  lucro_liquido: number | null;
  margem_liquida: number | null;
  roic: number | null;
};

type IndicadorResultado = { chave: "receita" | "margem" | "roic" | "lucro"; rotulo: string; categoria: EvidenciaCategoria };

const INDICADORES: IndicadorResultado[] = [
  { chave: "receita", rotulo: "Receita líquida", categoria: "receita" },
  { chave: "margem", rotulo: "Margem líquida", categoria: "margem" },
  { chave: "roic", rotulo: "ROIC", categoria: "roic" },
  { chave: "lucro", rotulo: "Lucro líquido", categoria: "outro" },
];

/** Limiar mínimo de variação relativa (10%) para virar evidência — evita ruído de arredondamento entre competências. */
const LIMIAR_VARIACAO_RELATIVA = 0.1;

function valorDe(row: FundamentoAnualRow, chave: IndicadorResultado["chave"]): number | null {
  if (chave === "receita") return row.receita_liquida;
  if (chave === "margem") return row.margem_liquida;
  if (chave === "roic") return row.roic;
  return row.lucro_liquido;
}

/**
 * Função pura — `porTickerAscendente` já vem com a série de cada ticker
 * ordenada por competência crescente. Compara só o último par consecutivo
 * (mesma lógica de "chegou balanço novo, o que mudou" — não reprocessa
 * histórico inteiro a cada rodada).
 */
export function emitirEvidenciasResultados(porTickerAscendente: Map<string, FundamentoAnualRow[]>): EntradaEvidenciaEnriquecida[] {
  const saida: EntradaEvidenciaEnriquecida[] = [];
  for (const serie of porTickerAscendente.values()) {
    if (serie.length < 2) continue;
    const atual = serie[serie.length - 1];
    const anterior = serie[serie.length - 2];
    for (const indicador of INDICADORES) {
      const vAnterior = valorDe(anterior, indicador.chave);
      const vAtual = valorDe(atual, indicador.chave);
      if (vAnterior === null || vAtual === null || vAnterior === 0) continue;
      const variacaoRelativa = (vAtual - vAnterior) / Math.abs(vAnterior);
      if (Math.abs(variacaoRelativa) < LIMIAR_VARIACAO_RELATIVA) continue;
      const direcao = variacaoRelativa > 0 ? "aumentou" : "caiu";
      saida.push({
        ticker: atual.ticker,
        categoria: indicador.categoria,
        origem: "CVM (DFP/ITR)",
        data: atual.competencia,
        pesoInformativo: variacaoRelativa > 0 ? 1 : -1,
        confiabilidade: "alta",
        descricao: `${indicador.rotulo} ${direcao} de ${vAnterior.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} (${anterior.competencia}) para ${vAtual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} (${atual.competencia}) — ${(variacaoRelativa * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%.`,
        payload: { ticker: atual.ticker, indicador: indicador.chave, anterior: vAnterior, atual: vAtual, competenciaAnterior: anterior.competencia, competenciaAtual: atual.competencia },
        subcategoria: "Financeiro",
        titulo: `${indicador.rotulo} ${direcao} (${atual.competencia})`,
        urlOficial: null,
        documentoOficial: null,
      });
    }
  }
  return saida;
}
