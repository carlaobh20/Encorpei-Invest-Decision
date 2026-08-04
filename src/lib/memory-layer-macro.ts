import type { EntradaEvidenciaEnriquecida } from "./memory-layer";

/**
 * COLETOR 8 — MACRO (Bloco 2, Sprint 2.3).
 *
 * A coleta já existe e já roda (tools/coleta_focus.py, cron semanal
 * segunda 09h BRT via .github/workflows/coleta-focus.yml, grava em
 * `macro_focus`, migração 012 — fonte: API Olinda/BCB). Este arquivo só
 * detecta mudança relevante na mediana Focus por indicador/ano de
 * referência e adapta para Evidence — "nunca interpretar" (spec): a
 * evidência registra QUE a projeção mudou e QUANTO, nunca se isso é bom ou
 * ruim para uma empresa específica (isso depende do setor/exposição de
 * cada uma e é trabalho do Explanation Engine, não deste coletor).
 *
 * Corte estrutural: `evidencias.ticker` tem FK obrigatória para
 * `empresas(ticker)` (migração 021) — não existe "evidência sem empresa"
 * no schema atual. Como uma mudança de Focus é, por natureza, a mesma para
 * toda a carteira, este emissor faz fan-out: UMA evidência por empresa do
 * universo recebido. Não é duplicação (chaves de dedup diferem por
 * ticker), é a única forma de uma evidência macro aparecer depois na
 * árvore causal ou na timeline de uma empresa específica — o Cause & Effect
 * Engine (`evidenciasAtivasDoTicker`) já filtra evidência por ticker
 * exatamente assim.
 */

export type MacroFocusRow = {
  indicador: string;
  data_pesquisa: string;
  ano_referencia: number;
  mediana: number;
};

/** Variação mínima pra virar evento — unidade nativa de cada indicador (pontos percentuais para Selic/IPCA/PIB, R$ para Câmbio). Mesmo espírito de LIMIARES_TIMELINE (decision-timeline.ts), limiares próprios por não serem o mesmo tipo de grandeza. */
const LIMIARES_MACRO_FOCUS: Record<string, number> = {
  Selic: 0.25,
  IPCA: 0.1,
  "PIB Total": 0.1,
  Câmbio: 0.05,
};

function limiarDe(indicador: string): number {
  return LIMIARES_MACRO_FOCUS[indicador] ?? 0.1;
}

/** Agrupa a série por indicador+ano de referência e ordena por data de pesquisa ascendente — pré-requisito pra comparar "anterior vs atual" corretamente. */
export function agruparSerieMacro(rows: MacroFocusRow[]): Map<string, MacroFocusRow[]> {
  const porChave = new Map<string, MacroFocusRow[]>();
  for (const r of rows) {
    const chave = `${r.indicador}|${r.ano_referencia}`;
    const lista = porChave.get(chave) ?? [];
    lista.push(r);
    porChave.set(chave, lista);
  }
  for (const lista of porChave.values()) {
    lista.sort((a, b) => a.data_pesquisa.localeCompare(b.data_pesquisa));
  }
  return porChave;
}

/**
 * Função pura — `serieAscendente` já vem agrupada (ver `agruparSerieMacro`),
 * `tickersUniverso` é a lista de tickers que devem receber a evidência
 * (fan-out). Devolve candidatas, ainda não deduplicadas nem persistidas.
 */
export function emitirEvidenciasMacro(serieAscendente: Map<string, MacroFocusRow[]>, tickersUniverso: string[]): EntradaEvidenciaEnriquecida[] {
  const saida: EntradaEvidenciaEnriquecida[] = [];
  for (const serie of serieAscendente.values()) {
    for (let i = 1; i < serie.length; i++) {
      const anterior = serie[i - 1];
      const atual = serie[i];
      const diff = atual.mediana - anterior.mediana;
      if (Math.abs(diff) < limiarDe(atual.indicador)) continue;
      const sinalDiff = diff >= 0 ? "+" : "";
      const descricao = `Mediana Focus de ${atual.indicador} (ref. ${atual.ano_referencia}) mudou de ${anterior.mediana.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} para ${atual.mediana.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} (${sinalDiff}${diff.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}).`;
      for (const ticker of tickersUniverso) {
        saida.push({
          ticker,
          categoria: "macro_focus",
          origem: "BCB (Focus/Olinda)",
          data: atual.data_pesquisa,
          pesoInformativo: 0,
          confiabilidade: "alta",
          descricao,
          payload: { indicador: atual.indicador, anoReferencia: atual.ano_referencia, anterior: anterior.mediana, atual: atual.mediana, dataPesquisa: atual.data_pesquisa },
          subcategoria: "Macro",
          titulo: `Focus ${atual.indicador} ${atual.ano_referencia}: ${anterior.mediana} → ${atual.mediana}`,
          urlOficial: null,
          documentoOficial: null,
        });
      }
    }
  }
  return saida;
}
