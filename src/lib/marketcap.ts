/**
 * SELEÇÃO DE VALOR DE MERCADO — auditoria de dados de 03/08/2026.
 *
 * Bug encontrado: radar.ts, compounder-dados.ts e comparar/page.tsx sempre
 * preferiam `qtd_acoes (acoes_totais) × fechamento` ("mcOficial") ao
 * `market_cap` que a própria brapi devolve, sem NENHUMA checagem de
 * divergência. `acoes_totais` é alimentado pela "composição do capital" da
 * CVM, que só é re-publicada quando a empresa refila — então um
 * desdobramento/grupamento recente fica com o número de ações ANTIGO até a
 * CVM atualizar o filing, e o valor de mercado calculado sai muito errado
 * (caso confirmado: SBSP3 saiu ~80% menor que a realidade, com o número de
 * ações da CVM defasado em ~5x de um desdobramento aparente).
 *
 * Correção: quando o valor calculado a partir de `acoes_totais` diverge
 * MUITO (>10%, mesma banda `bloqueio` de src/lib/auditoria.ts) do que a
 * própria fonte (brapi) reporta como market_cap ao vivo, o sistema passa a
 * confiar no dado ao vivo — que é o mesmo dado que o próprio pipeline já
 * coleta todo dia, não uma fonte nova. Não inventa nada: só para de dar
 * preferência cega a um número que pode estar desatualizado.
 */

const DIVERGENCIA_MAXIMA = 0.1; // = BANDAS_DIVERGENCIA.bloqueio em auditoria.ts

export type FonteMarketCap = "cvm_acoes_totais" | "brapi_live" | "brapi_live_divergencia" | "indisponivel";

export type MarketCapSelecionado = {
  valor: number | null;
  fonte: FonteMarketCap;
  /** null quando não há os dois valores para comparar */
  divergenciaPct: number | null;
};

export function marketCapSelecionado(input: {
  qtdAcoes: number | null | undefined;
  fechamento: number | null | undefined;
  marketCapMercado: number | null | undefined;
  /** units (ex.: TAEE11, KLBN11) não usam qtd_acoes × fechamento nesta v1 */
  ehUnit: boolean;
}): MarketCapSelecionado {
  const { qtdAcoes, fechamento, ehUnit } = input;
  const marketCapMercado =
    input.marketCapMercado !== null && input.marketCapMercado !== undefined
      ? Number(input.marketCapMercado)
      : null;

  const mcOficial =
    !ehUnit && qtdAcoes && fechamento ? Number(qtdAcoes) * Number(fechamento) : null;

  if (mcOficial === null) {
    return marketCapMercado !== null
      ? { valor: marketCapMercado, fonte: "brapi_live", divergenciaPct: null }
      : { valor: null, fonte: "indisponivel", divergenciaPct: null };
  }

  if (marketCapMercado === null || marketCapMercado === 0) {
    return { valor: mcOficial, fonte: "cvm_acoes_totais", divergenciaPct: null };
  }

  const divergenciaPct = Math.abs(mcOficial - marketCapMercado) / marketCapMercado;

  if (divergenciaPct >= DIVERGENCIA_MAXIMA) {
    // Provável causa: acoes_totais desatualizado (desdobramento/grupamento/
    // emissão que a CVM ainda não refilou) — confia no dado ao vivo.
    return { valor: marketCapMercado, fonte: "brapi_live_divergencia", divergenciaPct };
  }

  return { valor: mcOficial, fonte: "cvm_acoes_totais", divergenciaPct };
}
