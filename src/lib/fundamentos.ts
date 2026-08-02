/**
 * Cálculos financeiros compartilhados entre o motor diário e o Radar.
 * Função pura — mesma regra em todo lugar, nunca duplicada.
 */

type LinhaLucro = {
  competencia: string;
  fonte: string;
  lucro_liquido: number | string | null;
};

/**
 * Lucro dos últimos 12 meses: último anual (DFP) + trimestres posteriores
 * (ITR) − trimestres equivalentes do ano anterior. Se faltar qualquer peça,
 * devolve null — o sistema nunca inventa o que não sabe.
 * `funds` deve vir ordenado do mais recente para o mais antigo.
 */
export function lucroLTM(funds: LinhaLucro[]): number | null {
  const dfp = funds.find((f) => f.fonte === "cvm_dfp");
  if (!dfp || dfp.lucro_liquido === null || dfp.lucro_liquido === undefined) {
    return null;
  }
  let ltm = Number(dfp.lucro_liquido);
  const posteriores = funds.filter(
    (f) => f.fonte === "cvm_itr" && f.competencia > dfp.competencia
  );
  for (const p of posteriores) {
    const anoAnterior = `${Number(p.competencia.slice(0, 4)) - 1}${p.competencia.slice(4)}`;
    const eq = funds.find(
      (f) => f.fonte === "cvm_itr" && f.competencia === anoAnterior
    );
    if (p.lucro_liquido === null || !eq || eq.lucro_liquido === null) {
      return null;
    }
    ltm += Number(p.lucro_liquido) - Number(eq.lucro_liquido);
  }
  return ltm;
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
