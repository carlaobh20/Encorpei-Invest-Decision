/**
 * Interpolação linear por faixas — usada por todo motor de nota do
 * Encorpei (Compounder, Technical) para mapear um valor bruto (ex.: ROIC,
 * RSI) numa nota 0-100 sem pesos escondidos: os pontos de corte ficam
 * escritos no chamador, nunca aqui.
 */
export type ComponentePonderado = { peso: number; valor: number | null };

/**
 * Média ponderada entre componentes DISPONÍVEIS (valor !== null), com o
 * peso renormalizado entre os que sobraram — o mesmo cálculo que
 * `calcularConfluencia`/`calcularConfluenciaV2` (confluencia.ts) já faziam
 * cada um com sua própria cópia inline. Extraído no Foundation v4 (Módulo
 * 13, auditoria de domínio) para o Portfolio Fit Engine reaproveitar em vez
 * de duplicar pela terceira vez — Confluence v1/v2 NÃO foram refatoradas
 * para usar esta função (evitar mudar comportamento já em produção sem
 * necessidade), mas todo código novo deve usar esta em vez de reinventar.
 */
export function mediaPonderadaRenormalizada(componentes: ComponentePonderado[]): { valor: number | null; pesoDisponivel: number } {
  const disponiveis = componentes.filter((c): c is { peso: number; valor: number } => c.valor !== null);
  const pesoDisponivel = disponiveis.reduce((a, c) => a + c.peso, 0);
  const valor = disponiveis.length === 0 || pesoDisponivel === 0 ? null : disponiveis.reduce((a, c) => a + c.valor * c.peso, 0) / pesoDisponivel;
  return { valor, pesoDisponivel };
}

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
