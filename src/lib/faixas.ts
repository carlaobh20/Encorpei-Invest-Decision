/**
 * Interpolação linear por faixas — usada por todo motor de nota do
 * Encorpei (Compounder, Technical) para mapear um valor bruto (ex.: ROIC,
 * RSI) numa nota 0-100 sem pesos escondidos: os pontos de corte ficam
 * escritos no chamador, nunca aqui.
 */
export function mapaFaixas(valor: number, pontos: [number, number][]): number {
  if (valor <= pontos[0][0]) return pontos[0][1];
  for (let i = 1; i < pontos.length; i++) {
    const [x0, y0] = pontos[i - 1];
    const [x1, y1] = pontos[i];
    if (valor <= x1) {
      const t = (valor - x0) / (x1 - x0);
      return y0 + t * (y1 - y0);
    }
  }
  return pontos[pontos.length - 1][1];
}
