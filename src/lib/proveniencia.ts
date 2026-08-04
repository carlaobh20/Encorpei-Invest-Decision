import { createHash } from "node:crypto";

/**
 * FDIE v2 — METADADOS DE PROVENIÊNCIA (Foundation v3 — Módulo 4).
 *
 * A especificação pede que todo indicador carregue: Fonte, Documento,
 * Linha, Página, Data, Versão, Hash, Timestamp, Confiabilidade.
 *
 * Corte honesto (confirmado por `auditoria.ts` e por varredura em
 * `tools/*.py`, 04/08/2026): o pipeline lê os dados estruturados que a CVM
 * publica (XBRL/JSON), nunca escaneia páginas de PDF. "Linha" e "página" de
 * um documento simplesmente NÃO EXISTEM nesse fluxo — não é uma peça que
 * falta implementar, é um dado que a fonte não produz. Por isso os dois
 * campos ficam SEMPRE `null`, com o motivo escrito ao lado, nunca
 * inventados (ex.: nunca "página 1" como placeholder).
 *
 * `hash` é a peça genuinamente nova e tecnicamente viável: SHA-256 do
 * payload bruto (o que a fonte devolveu, antes de qualquer tratamento) —
 * dá pra provar depois que um número não foi alterado silenciosamente.
 *
 * Função pura: `timestamp` é sempre injetado por quem chama (nunca
 * `new Date()` interno) — mantém testável e reproduzível.
 */

export type ConfiabilidadeProveniencia = "alta" | "media" | "baixa";

export type EntradaProveniencia = {
  /** ex.: "CVM (ITR)", "CVM (DFP)", "brapi" */
  fonte: string;
  /** nº do documento/protocolo da fonte, quando a fonte expõe um (ex.: nº do ITR na CVM) */
  documento: string | null;
  /** competência/data de referência do dado (ex.: "2026-06-30") */
  data: string | null;
  versao: string | number | null;
  /** payload bruto tal como a fonte devolveu — usado para o hash, nunca alterado */
  payload: unknown;
  confiabilidade: ConfiabilidadeProveniencia;
};

export type Proveniencia = {
  fonte: string;
  documento: string | null;
  /** sempre null — ver motivoAusenciaLinhaPagina */
  linha: null;
  /** sempre null — ver motivoAusenciaLinhaPagina */
  pagina: null;
  motivoAusenciaLinhaPagina: string;
  data: string | null;
  versao: string | number | null;
  /** SHA-256 (hex) do payload bruto */
  hash: string;
  timestamp: string;
  confiabilidade: ConfiabilidadeProveniencia;
};

const MOTIVO_AUSENCIA_LINHA_PAGINA =
  "Não aplicável: este dado vem da API estruturada (XBRL/JSON) da CVM ou da brapi, nunca de leitura de PDF — não existe número de linha/página para citar. Ver src/lib/auditoria.ts e roadmap/fdie-fase1.md.";

export function montarProveniencia(entrada: EntradaProveniencia, timestamp: string): Proveniencia {
  const hash = createHash("sha256").update(JSON.stringify(entrada.payload ?? null)).digest("hex");
  return {
    fonte: entrada.fonte,
    documento: entrada.documento,
    linha: null,
    pagina: null,
    motivoAusenciaLinhaPagina: MOTIVO_AUSENCIA_LINHA_PAGINA,
    data: entrada.data,
    versao: entrada.versao,
    hash,
    timestamp,
    confiabilidade: entrada.confiabilidade,
  };
}
