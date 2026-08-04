import type { EntradaEvidenciaEnriquecida } from "./memory-layer";

/**
 * COLETOR 1 — COMUNICADOS (Bloco 2, Sprint 2.3).
 *
 * NÃO é um coletor novo de dado bruto — a coleta em si já existe e já roda
 * (tools/coleta_ipe.py, cron diário 07h BRT via .github/workflows/coleta-ipe.yml,
 * grava em `comunicados_oficiais`, migração 010). Este arquivo é só a
 * ADAPTAÇÃO desse dado já estruturado para o formato de Evidence — nenhuma
 * chamada de rede, nenhuma leitura de PDF aqui.
 *
 * Corte honesto sobre categoria: `EvidenciaCategoria` (Foundation congelado,
 * src/lib/evidence.ts) não tem um valor dedicado para "comunicado da CVM"
 * genérico — as opções mais próximas (guidance/regulatorio) exigiriam ler o
 * `assunto` e INTERPRETAR do que se trata, o que a spec desta sprint proíbe
 * explicitamente ("nunca interpretar"). Por isso todo comunicado nasce como
 * categoria "outro" (valor já existente no enum, não uma extensão) — a
 * classificação mais rica (Financeiro/Governança/Estratégico) vai só no
 * campo de exibição `subcategoria` (migração 023), que nenhum motor lê.
 *
 * Pelo mesmo motivo, `pesoInformativo` nasce sempre 0 (nem favorável, nem
 * desfavorável) — o fato é registrado, a direção fica para quem interpretar
 * depois (Explanation Engine ou revisão humana), nunca inventada aqui.
 */

export type ComunicadoOficialRow = {
  ticker: string;
  data_entrega: string;
  categoria: string;
  assunto: string;
  link: string | null;
  protocolo: string | null;
};

const SUBCATEGORIA_POR_CATEGORIA_CVM: Record<string, string> = {
  "FATO RELEVANTE": "Estratégico",
  "COMUNICADO AO MERCADO": "Estratégico",
  "APRESENTACOES A INVESTIDORES": "Financeiro",
  "APRESENTACAO": "Financeiro",
  "DADOS ECONOMICO-FINANCEIROS": "Financeiro",
};

function truncar(s: string, limite: number): string {
  return s.length > limite ? `${s.slice(0, limite - 3)}...` : s;
}

/** Função pura — recebe linhas já lidas de `comunicados_oficiais`, devolve candidatas a Evidence (ainda não deduplicadas nem persistidas). */
export function emitirEvidenciasComunicados(rows: ComunicadoOficialRow[]): EntradaEvidenciaEnriquecida[] {
  return rows.map((r) => {
    const categoriaNorm = r.categoria.trim().toUpperCase();
    const subcategoria = SUBCATEGORIA_POR_CATEGORIA_CVM[categoriaNorm] ?? "Estratégico";
    return {
      ticker: r.ticker,
      categoria: "outro",
      origem: "CVM (IPE)",
      data: r.data_entrega,
      pesoInformativo: 0,
      confiabilidade: "alta",
      descricao: `${r.categoria}: ${r.assunto}`,
      payload: r,
      subcategoria,
      titulo: truncar(r.assunto, 80),
      urlOficial: r.link,
      documentoOficial: r.protocolo,
    } satisfies EntradaEvidenciaEnriquecida;
  });
}
