/**
 * Cálculos financeiros compartilhados entre o motor diário e o Radar.
 * Função pura — mesma regra em todo lugar, nunca duplicada.
 */

type LinhaPeriodo = {
  competencia: string;
  fonte: string;
};

/**
 * Valor dos últimos 12 meses de um campo somável (lucro, receita):
 * último anual (DFP) + trimestres posteriores (ITR) − trimestres
 * equivalentes do ano anterior. Se faltar qualquer peça, devolve null —
 * o sistema nunca inventa o que não sabe.
 * `funds` deve vir ordenado do mais recente para o mais antigo.
 */
export function ltmCampo<T extends LinhaPeriodo>(
  funds: T[],
  pega: (f: T) => number | string | null | undefined
): number | null {
  const dfp = funds.find((f) => f.fonte === "cvm_dfp");
  if (!dfp || pega(dfp) === null || pega(dfp) === undefined) {
    return null;
  }
  let ltm = Number(pega(dfp));
  const posteriores = funds.filter(
    (f) => f.fonte === "cvm_itr" && f.competencia > dfp.competencia
  );
  for (const p of posteriores) {
    const anoAnterior = `${Number(p.competencia.slice(0, 4)) - 1}${p.competencia.slice(4)}`;
    const eq = funds.find(
      (f) => f.fonte === "cvm_itr" && f.competencia === anoAnterior
    );
    if (pega(p) === null || pega(p) === undefined || !eq || pega(eq) === null || pega(eq) === undefined) {
      return null;
    }
    ltm += Number(pega(p)) - Number(pega(eq));
  }
  return ltm;
}

/** Lucro dos últimos 12 meses (atalho histórico — mesma regra do ltmCampo). */
export function lucroLTM(
  funds: (LinhaPeriodo & { lucro_liquido: number | string | null })[]
): number | null {
  return ltmCampo(funds, (f) => f.lucro_liquido);
}

/** Média dos ROICs dos últimos 4 trimestres (ITR) — a régua dos gatilhos. */
export function roicMedia4Tri(
  funds: { fonte: string; roic: number | string | null }[]
): number | null {
  const tri = funds
    .filter((f) => f.fonte === "cvm_itr" && f.roic !== null)
    .slice(0, 4)
    .map((f) => Number(f.roic));
  if (tri.length === 0) return null;
  return tri.reduce((a, b) => a + b, 0) / tri.length;
}
