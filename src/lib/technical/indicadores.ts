/**
 * INDICADORES TÉCNICOS — funções puras, matemática padrão, sem opinião.
 * Toda função espera as séries ORDENADAS DO MAIS ANTIGO PARA O MAIS
 * RECENTE (convenção padrão de biblioteca de TA) e devolve `null` quando
 * não há dias suficientes — nunca calcula com janela incompleta disfarçada.
 */

export function sma(closes: number[], periodo: number): number | null {
  if (closes.length < periodo) return null;
  const janela = closes.slice(closes.length - periodo);
  return janela.reduce((a, b) => a + b, 0) / periodo;
}

export function ema(closes: number[], periodo: number): number | null {
  if (closes.length < periodo) return null;
  const k = 2 / (periodo + 1);
  let valor = closes.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  for (let i = periodo; i < closes.length; i++) {
    valor = closes[i] * k + valor * (1 - k);
  }
  return valor;
}

/** RSI de Wilder, período padrão 14. */
export function rsi(closes: number[], periodo = 14): number | null {
  if (closes.length < periodo + 1) return null;
  let ganhos = 0;
  let perdas = 0;
  for (let i = 1; i <= periodo; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) ganhos += d;
    else perdas -= d;
  }
  let mediaGanho = ganhos / periodo;
  let mediaPerda = perdas / periodo;
  for (let i = periodo + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    const ganho = d > 0 ? d : 0;
    const perda = d < 0 ? -d : 0;
    mediaGanho = (mediaGanho * (periodo - 1) + ganho) / periodo;
    mediaPerda = (mediaPerda * (periodo - 1) + perda) / periodo;
  }
  if (mediaPerda === 0) return 100;
  const rs = mediaGanho / mediaPerda;
  return 100 - 100 / (1 + rs);
}

/** MACD(12,26,9) — devolve a linha MACD, a linha de sinal e o histograma no último ponto. */
export function macd(
  closes: number[],
  rapida = 12,
  lenta = 26,
  sinal = 9
): { macd: number; sinal: number; histograma: number } | null {
  if (closes.length < lenta + sinal) return null;
  const emaSerie = (periodo: number): number[] => {
    const k = 2 / (periodo + 1);
    const out: number[] = [];
    let valor = closes.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
    out[periodo - 1] = valor;
    for (let i = periodo; i < closes.length; i++) {
      valor = closes[i] * k + valor * (1 - k);
      out[i] = valor;
    }
    return out;
  };
  const emaRapida = emaSerie(rapida);
  const emaLenta = emaSerie(lenta);
  const macdSerie: number[] = [];
  for (let i = lenta - 1; i < closes.length; i++) {
    macdSerie[i] = emaRapida[i] - emaLenta[i];
  }
  const macdValidos = macdSerie.filter((v) => v !== undefined);
  if (macdValidos.length < sinal) return null;
  const kSinal = 2 / (sinal + 1);
  let linhaSinal = macdValidos.slice(0, sinal).reduce((a, b) => a + b, 0) / sinal;
  for (let i = sinal; i < macdValidos.length; i++) {
    linhaSinal = macdValidos[i] * kSinal + linhaSinal * (1 - kSinal);
  }
  const ultimoMacd = macdValidos[macdValidos.length - 1];
  return { macd: ultimoMacd, sinal: linhaSinal, histograma: ultimoMacd - linhaSinal };
}

/** ROC (taxa de variação) em N períodos. */
export function roc(closes: number[], periodo: number): number | null {
  if (closes.length < periodo + 1) return null;
  const atual = closes[closes.length - 1];
  const anterior = closes[closes.length - 1 - periodo];
  if (anterior === 0) return null;
  return atual / anterior - 1;
}

export function bollinger(
  closes: number[],
  periodo = 20,
  multiplicador = 2
): { media: number; superior: number; inferior: number; largura: number } | null {
  if (closes.length < periodo) return null;
  const janela = closes.slice(closes.length - periodo);
  const media = janela.reduce((a, b) => a + b, 0) / periodo;
  const variancia = janela.reduce((acc, v) => acc + (v - media) ** 2, 0) / periodo;
  const desvio = Math.sqrt(variancia);
  const superior = media + multiplicador * desvio;
  const inferior = media - multiplicador * desvio;
  return { media, superior, inferior, largura: (superior - inferior) / media };
}

/** ATR de Wilder — precisa de máxima/mínima reais (não é aproximação por fechamento). */
export function atr(
  maximas: number[],
  minimas: number[],
  closes: number[],
  periodo = 14
): number | null {
  if (maximas.length < periodo + 1 || minimas.length < periodo + 1 || closes.length < periodo + 1) return null;
  const tr: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    const a = maximas[i] - minimas[i];
    const b = Math.abs(maximas[i] - closes[i - 1]);
    const c = Math.abs(minimas[i] - closes[i - 1]);
    tr.push(Math.max(a, b, c));
  }
  if (tr.length < periodo) return null;
  let valor = tr.slice(0, periodo).reduce((a, b) => a + b, 0) / periodo;
  for (let i = periodo; i < tr.length; i++) {
    valor = (valor * (periodo - 1) + tr[i]) / periodo;
  }
  return valor;
}

/** OBV — série completa (para olhar a inclinação recente, não só o valor absoluto). */
export function obvSerie(closes: number[], volumes: number[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < closes.length; i++) {
    const dir = closes[i] > closes[i - 1] ? 1 : closes[i] < closes[i - 1] ? -1 : 0;
    out.push(out[i - 1] + dir * (volumes[i] ?? 0));
  }
  return out;
}

export function volumeRelativo(volumes: number[], periodo = 20): number | null {
  if (volumes.length < periodo + 1) return null;
  const janela = volumes.slice(volumes.length - 1 - periodo, volumes.length - 1);
  const media = janela.reduce((a, b) => a + b, 0) / periodo;
  if (media === 0) return null;
  return volumes[volumes.length - 1] / media;
}

export type Pivot = { indice: number; valor: number; tipo: "topo" | "fundo" };

/** Pivôs locais (topo/fundo) com janela de confirmação de cada lado. */
export function encontrarPivots(maximas: number[], minimas: number[], janela = 3): Pivot[] {
  const pivots: Pivot[] = [];
  for (let i = janela; i < maximas.length - janela; i++) {
    const vizMax = maximas.slice(i - janela, i + janela + 1);
    if (maximas[i] === Math.max(...vizMax)) pivots.push({ indice: i, valor: maximas[i], tipo: "topo" });
    const vizMin = minimas.slice(i - janela, i + janela + 1);
    if (minimas[i] === Math.min(...vizMin)) pivots.push({ indice: i, valor: minimas[i], tipo: "fundo" });
  }
  return pivots;
}
