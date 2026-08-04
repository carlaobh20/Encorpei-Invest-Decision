/**
 * CONFIDENCE INTERVAL (Foundation v3.1 — Módulo 5).
 *
 * Tipo genérico para qualquer estimativa que hoje é publicada como número
 * solto (ex.: retorno esperado, drawdown esperado). Regra: nunca devolver
 * só um valor — sempre valor + intervalo + nível de confiança, ou null +
 * motivo quando não há dado suficiente. Consumido pelo Probability Engine
 * V2 (`probability-engine-v2.ts`); qualquer motor futuro que precise do
 * mesmo formato reaproveita este tipo em vez de inventar outro.
 */

export type EstimativaComIntervalo = {
  valor: number | null;
  intervaloInferior: number | null;
  intervaloSuperior: number | null;
  /** fração 0-1 (ex.: 0.8 = intervalo cobre 80% das observações) — null junto com o resto quando não há dado */
  nivelConfianca: number | null;
  /** presente sempre que valor/intervalo são null — nunca deixa a ausência sem explicação */
  motivo: string | null;
};

export function estimativaIndisponivel(motivo: string): EstimativaComIntervalo {
  return { valor: null, intervaloInferior: null, intervaloSuperior: null, nivelConfianca: null, motivo };
}

/** Percentil linear simples (método "inclusive") sobre uma amostra numérica. `p` em 0-1. */
export function percentil(amostra: number[], p: number): number | null {
  if (amostra.length === 0) return null;
  const ordenada = [...amostra].sort((a, b) => a - b);
  if (ordenada.length === 1) return ordenada[0];
  const pos = p * (ordenada.length - 1);
  const base = Math.floor(pos);
  const resto = pos - base;
  const abaixo = ordenada[base];
  const acima = ordenada[Math.min(base + 1, ordenada.length - 1)];
  return abaixo + (acima - abaixo) * resto;
}

/**
 * Constrói uma EstimativaComIntervalo a partir de uma amostra empírica:
 * valor = média, intervalo = percentis [p10, p90] (não-paramétrico —
 * apropriado para distribuições de retorno, que costumam ser assimétricas).
 */
export function estimativaDeAmostra(amostra: number[], nivelConfianca = 0.8): EstimativaComIntervalo {
  if (amostra.length === 0) {
    return estimativaIndisponivel("Amostra vazia — sem observações para estimar.");
  }
  const media = amostra.reduce((a, b) => a + b, 0) / amostra.length;
  const pInferior = (1 - nivelConfianca) / 2;
  const pSuperior = 1 - pInferior;
  return {
    valor: media,
    intervaloInferior: percentil(amostra, pInferior),
    intervaloSuperior: percentil(amostra, pSuperior),
    nivelConfianca,
    motivo: null,
  };
}
