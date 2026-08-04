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

/**
 * Nível de confiança 3-graus — o MESMO padrão ("alta"|"media"|"baixa") já usado
 * em ~11 arquivos do domínio (radar.ts, score.ts, carry/types.ts, compounder/*,
 * technical/*, decision-dna.ts). Achado da auditoria do Foundation v3.1
 * (Módulo 8): não valeu a pena migrar os 11 arquivos existentes para este tipo
 * (mudança ampla, fora do escopo incremental deste sprint — risco não
 * justificado). A partir daqui, porém, todo módulo NOVO reusa este tipo em vez
 * de declarar mais uma cópia da mesma união de 3 strings.
 */
export type NivelConfianca = "alta" | "media" | "baixa";

/** @deprecated use NivelConfianca — mantido por compatibilidade com o Bloco 1 */
export type ConfiabilidadeProveniencia = NivelConfianca;

/** SHA-256 (hex) de um payload qualquer, serializado como JSON. Reaproveitado pelo Evidence Engine — mesmo hash, um lugar só. */
export function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload ?? null)).digest("hex");
}

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
  const hash = hashPayload(entrada.payload);
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
