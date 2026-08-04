import { montarEvidencia, type EntradaEvidencia, type Evidencia } from "./evidence";

/**
 * MEMORY LAYER — núcleo (Bloco 2, Sprint 2.3).
 *
 * Este arquivo NÃO é um motor novo do Foundation — é a camada de
 * PERSISTÊNCIA/DEDUPLICAÇÃO em cima do Evidence Engine já congelado
 * (`src/lib/evidence.ts`, migração 021). `montarEvidencia` (frozen) continua
 * sendo a única função que decide o formato de uma evidência; este arquivo
 * só decide SE uma evidência candidata é nova ou duplicada, e carrega os
 * campos de exibição adicionais da migração 023 (subcategoria/título/URL
 * oficial/documento oficial) que a tabela ganhou mas que `Evidencia`
 * (tipo congelado) nunca leu nem lerá — nenhum motor do Foundation consome
 * esses 4 campos.
 *
 * Deduplicação (spec Sprint 2.3, seção DEDUPLICAÇÃO): a chave é
 * ticker+categoria+origem+data+hash — mesma regra do índice único
 * `evidencias_dedup_idx` (migração 023). A função aqui é a primeira linha
 * de defesa (evita round-trip de erro de constraint); o índice único é a
 * segunda (defesa em profundidade, nunca a única).
 */

export type CamposExibicaoEvidencia = {
  /** Taxonomia de exibição da Sprint 2.3 — rótulo de UI/auditoria, nunca consumido por regra de negócio. */
  subcategoria: string;
  titulo: string;
  urlOficial: string | null;
  documentoOficial: string | null;
};

export type EvidenciaEnriquecida = Evidencia & CamposExibicaoEvidencia;
export type EntradaEvidenciaEnriquecida = EntradaEvidencia & CamposExibicaoEvidencia;

/** Mesmo `montarEvidencia` do Evidence Engine congelado, só acrescentando os campos de exibição da migração 023. */
export function montarEvidenciaEnriquecida(entrada: EntradaEvidenciaEnriquecida, timestamp: string): EvidenciaEnriquecida {
  const base = montarEvidencia(entrada, timestamp);
  return {
    ...base,
    subcategoria: entrada.subcategoria,
    titulo: entrada.titulo,
    urlOficial: entrada.urlOficial,
    documentoOficial: entrada.documentoOficial,
  };
}

export type ChaveDedupEvidencia = {
  ticker: string;
  categoria: string;
  origem: string;
  data: string;
  hash: string;
};

function chaveDedup(e: ChaveDedupEvidencia): string {
  return `${e.ticker}|${e.categoria}|${e.origem}|${e.data}|${e.hash}`;
}

/**
 * Filtra candidatas que já existem (comparando contra evidências já
 * persistidas) e também deduplica DENTRO do próprio lote candidato (dois
 * coletores diferentes rodando na mesma leva não podem gerar duas linhas
 * iguais). Nunca lança erro — só devolve o que é genuinamente novo.
 */
export function filtrarEvidenciasNovas<T extends ChaveDedupEvidencia>(
  candidatas: T[],
  existentes: ChaveDedupEvidencia[]
): T[] {
  const vistos = new Set(existentes.map(chaveDedup));
  const novas: T[] = [];
  for (const candidata of candidatas) {
    const chave = chaveDedup(candidata);
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    novas.push(candidata);
  }
  return novas;
}

export type ResultadoLogColeta = {
  coletor: string;
  iniciadoEm: string;
  concluidoEm: string;
  quantidadeNovas: number;
  quantidadeIgnoradasDuplicadas: number;
  quantidadeErros: number;
  detalhes?: Record<string, unknown>;
};

/**
 * Monta o registro de log de uma execução de coletor (spec Sprint 2.3,
 * seção LOGS) — função pura, quem chama decide quando persistir em
 * `evidencias_coleta_log` (migração 023).
 */
export function montarLogColeta(params: {
  coletor: string;
  iniciadoEm: string;
  concluidoEm: string;
  candidatas: number;
  novas: number;
  erros?: number;
  detalhes?: Record<string, unknown>;
}): ResultadoLogColeta {
  return {
    coletor: params.coletor,
    iniciadoEm: params.iniciadoEm,
    concluidoEm: params.concluidoEm,
    quantidadeNovas: params.novas,
    quantidadeIgnoradasDuplicadas: params.candidatas - params.novas,
    quantidadeErros: params.erros ?? 0,
    detalhes: params.detalhes,
  };
}
