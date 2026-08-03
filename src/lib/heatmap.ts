/**
 * HEATMAP DA CARTEIRA — Meu Dash (Linha 4, reconstrução 03/08/2026).
 *
 * Traduz um retorno percentual real (`carteira.linhas[i].resultadoPct`) em
 * uma cor — mesma paleta semântica do resto do app (emerald-400 = ganho,
 * red-400 = perda). Puro e testável: nenhuma cor decorativa, e posição sem
 * `resultadoPct` (falta preço atual) fica neutra, nunca colorida como se
 * fosse zero.
 */

const NEUTRO = "rgba(148, 163, 184, 0.12)"; // slate-400 — "sem dado", não "zero"
const VERDE = [52, 211, 153]; // emerald-400
const VERMELHO = [248, 113, 113]; // red-400
const ALFA_MIN = 0.12;
const ALFA_MAX = 0.85;

/**
 * `escalaMax` = variação (em módulo) que já satura a cor na intensidade
 * máxima. Default 0.30 (±30%) — faixa razoável de oscilação de uma posição
 * em carteira sem esticar tudo pra tons quase idênticos.
 */
export function corHeatmapRetorno(pct: number | null, escalaMax = 0.3): string {
  if (pct === null || !Number.isFinite(pct)) return NEUTRO;
  if (escalaMax <= 0) escalaMax = 0.3;
  const intensidade = Math.min(Math.abs(pct) / escalaMax, 1);
  const alfa = ALFA_MIN + intensidade * (ALFA_MAX - ALFA_MIN);
  const [r, g, b] = pct >= 0 ? VERDE : VERMELHO;
  return `rgba(${r}, ${g}, ${b}, ${alfa.toFixed(3)})`;
}
