import { mapaFaixas } from "../faixas";
import {
  atr,
  bollinger,
  encontrarPivots,
  macd,
  obvSerie,
  roc,
  rsi,
  sma,
  volumeRelativo,
  type Pivot,
} from "./indicadores";
import {
  TECHNICAL_CONFIG,
  ROTULO_TIMING,
  FRASE_TIMING,
  type ComponenteId,
  type ComponenteResultado,
  type TechnicalEntrada,
  type TechnicalResultado,
  type Timing,
  type TeseTecnica,
} from "./types";

/**
 * TECHNICAL INTELLIGENCE ENGINE v1.
 *
 * Metodologia documentada em roadmap/technical-engine-v1.md. Resumo do
 * corte honesto: com ~60-300 pregões diários coletados por ticker (sem
 * histórico semanal/mensal próprio ainda), a hierarquia de timeframe
 * Semanal(60%)/Mensal(30%)/Diário(10%) pedida na especificação original
 * fica para uma v2 — esta v1 trabalha só com o diário, documentado como
 * limitação, nunca escondido. Padrões gráficos nomeados (triângulos, OCO,
 * ombro-cabeça-ombro, bandeiras) exigem curadoria visual e ficam de fora.
 * ADX e Estocástico ficam de fora do Momentum Engine nesta v1 (RSI+MACD+ROC
 * já formam um Momentum Score renormalizável). Backtest/Simulador/Timeline
 * ficam de fora (mesma razão do Compounder: profundidade histórica curta).
 *
 * Regra inegociável (igual Carry/Compounder): componente sem dado
 * suficiente fica NULO, peso renormalizado entre os que TÊM dado — nunca
 * um número inventado.
 *
 * Regra de linguagem (CLAUDE.md §7): a IA NUNCA diz "compre"/"venda". O
 * timing vira "Momento Favorável/Desfavorável" ou "Aguardar melhor ponto".
 */

const JANELA_SLOPE = 10;

function pct(v: number): string {
  return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

/** Série completa de SMA (um valor por índice, null enquanto não há janela cheia). */
function smaSerie(closes: number[], periodo: number): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    out.push(i + 1 >= periodo ? sma(closes.slice(0, i + 1), periodo) : null);
  }
  return out;
}

function tendenciaComponente(e: TechnicalEntrada): ComponenteResultado {
  const nome = "Tendência (MM9/MM21/MM72)";
  const { closes } = e;
  const sma9 = sma(closes, 9);
  const sma21 = sma(closes, 21);
  const sma72 = sma(closes, 72);

  if (sma9 === null || sma21 === null) {
    return {
      id: "tendencia",
      nome,
      peso: TECHNICAL_CONFIG.pesos.tendencia,
      valor: null,
      explicacao: `Menos de 21 pregões coletados (${closes.length}) — sem MM21 ainda para classificar tendência.`,
    };
  }

  let alignScore: number;
  let alinhamentoTexto: string;
  if (sma72 !== null) {
    if (sma9 > sma21 && sma21 > sma72) {
      alignScore = 90;
      alinhamentoTexto = "alinhamento de alta completo (MM9 > MM21 > MM72)";
    } else if (sma9 < sma21 && sma21 < sma72) {
      alignScore = 10;
      alinhamentoTexto = "alinhamento de baixa completo (MM9 < MM21 < MM72)";
    } else if (sma9 > sma21) {
      alignScore = 60;
      alinhamentoTexto = "MM9 acima da MM21, mas sem confirmação da MM72 (alinhamento misto)";
    } else {
      alignScore = 40;
      alinhamentoTexto = "MM9 abaixo da MM21, mas sem confirmação da MM72 (alinhamento misto)";
    }
  } else {
    alignScore = sma9 > sma21 ? 70 : sma9 < sma21 ? 30 : 50;
    alinhamentoTexto = `MM9 ${
      sma9 > sma21 ? "acima" : sma9 < sma21 ? "abaixo" : "igual"
    } da MM21 (sem MM72 — menos de 72 pregões coletados ainda: ${closes.length})`;
  }

  const sma21Antigo =
    closes.length >= 21 + JANELA_SLOPE ? sma(closes.slice(0, closes.length - JANELA_SLOPE), 21) : null;
  const slope = sma21Antigo !== null && sma21Antigo !== 0 ? sma21 / sma21Antigo - 1 : null;
  const slopeScore =
    slope !== null
      ? mapaFaixas(slope, [
          [-0.08, 10],
          [-0.02, 35],
          [0, 50],
          [0.02, 65],
          [0.08, 90],
        ])
      : null;

  const valor = slopeScore !== null ? alignScore * 0.65 + slopeScore * 0.35 : alignScore;

  // desde quando a tendência atual (MM9 vs MM21) está em vigor
  const s9 = smaSerie(closes, 9);
  const s21 = smaSerie(closes, 21);
  const sinalAtual = sma9 - sma21 > 0 ? 1 : sma9 - sma21 < 0 ? -1 : 0;
  let barrasDesde: number | null = null;
  if (sinalAtual !== 0) {
    let i = closes.length - 1;
    let barras = 0;
    while (i >= 0 && s9[i] !== null && s21[i] !== null) {
      const sinal = s9[i]! - s21[i]! > 0 ? 1 : s9[i]! - s21[i]! < 0 ? -1 : 0;
      if (sinal !== sinalAtual) break;
      barras++;
      i--;
    }
    barrasDesde = barras;
  }

  const explicacao = `${alinhamentoTexto}${
    slope !== null ? `; MM21 ${slope >= 0 ? "subindo" : "caindo"} ${pct(Math.abs(slope))} nos últimos ${JANELA_SLOPE} pregões` : ""
  }${barrasDesde !== null ? `; tendência atual (MM9 vs MM21) há ${barrasDesde} pregão(ões)` : ""}.`;

  return { id: "tendencia", nome, peso: TECHNICAL_CONFIG.pesos.tendencia, valor, explicacao };
}

function momentumComponente(e: TechnicalEntrada): ComponenteResultado {
  const nome = "Momentum (RSI + MACD + ROC)";
  const { closes } = e;
  const r = rsi(closes, 14);
  const m = macd(closes);
  const rc = roc(closes, 21);

  if (r === null && m === null && rc === null) {
    return {
      id: "momentum",
      nome,
      peso: TECHNICAL_CONFIG.pesos.momentum,
      valor: null,
      explicacao: `Dado insuficiente para RSI(14), MACD(12,26,9) ou ROC(21) ainda (${closes.length} pregões coletados).`,
    };
  }

  const rsiScore = r; // já é 0-100
  const macdScore =
    m !== null && closes[closes.length - 1] !== 0
      ? mapaFaixas(m.histograma / closes[closes.length - 1], [
          [-0.03, 10],
          [-0.005, 35],
          [0, 50],
          [0.005, 65],
          [0.03, 90],
        ])
      : null;
  const rocScore =
    rc !== null
      ? mapaFaixas(rc, [
          [-0.15, 10],
          [-0.03, 35],
          [0, 50],
          [0.03, 65],
          [0.15, 90],
        ])
      : null;

  const partes = [rsiScore, macdScore, rocScore].filter((v): v is number => v !== null);
  const valor = partes.reduce((a, b) => a + b, 0) / partes.length;

  const usados: string[] = [];
  if (r !== null) usados.push(`RSI(14) ${r.toFixed(1)}`);
  if (m !== null) usados.push(`MACD histograma ${fmt(m.histograma)}`);
  if (rc !== null) usados.push(`ROC(21) ${pct(rc)}`);
  const faltando: string[] = [];
  if (r === null) faltando.push("RSI");
  if (m === null) faltando.push("MACD");
  if (rc === null) faltando.push("ROC");

  return {
    id: "momentum",
    nome,
    peso: TECHNICAL_CONFIG.pesos.momentum,
    valor,
    explicacao: `${usados.join(", ")}.${
      faltando.length > 0 ? ` Sem dado ainda para: ${faltando.join(", ")} (peso redistribuído entre os disponíveis).` : ""
    } ADX e Estocástico ficam de fora nesta v1 (ver roadmap/technical-engine-v1.md).`,
  };
}

function volumeComponente(e: TechnicalEntrada): ComponenteResultado {
  const nome = "Volume (relativo + OBV)";
  const { closes, volumes } = e;
  const volRel = volumeRelativo(volumes, 20);
  const obv = obvSerie(closes, volumes);

  if (volRel === null && obv.length < JANELA_SLOPE + 1) {
    return {
      id: "volume",
      nome,
      peso: TECHNICAL_CONFIG.pesos.volume,
      valor: null,
      explicacao: `Volume insuficiente coletado ainda para volume relativo (20 pregões) ou OBV (${volumes.length} pregões disponíveis).`,
    };
  }

  const volRelScore =
    volRel !== null
      ? mapaFaixas(volRel, [
          [0.3, 20],
          [0.7, 40],
          [1, 50],
          [1.5, 70],
          [2.5, 90],
          [4, 100],
        ])
      : null;

  let obvScore: number | null = null;
  if (obv.length >= JANELA_SLOPE + 1) {
    const delta = obv[obv.length - 1] - obv[obv.length - 1 - JANELA_SLOPE];
    const volMedio = volumes.slice(-JANELA_SLOPE).reduce((a, b) => a + b, 0) / JANELA_SLOPE || 1;
    const deltaNorm = delta / (volMedio * JANELA_SLOPE);
    obvScore = mapaFaixas(deltaNorm, [
      [-0.5, 15],
      [-0.15, 35],
      [0, 50],
      [0.15, 65],
      [0.5, 85],
    ]);
  }

  const partes = [volRelScore, obvScore].filter((v): v is number => v !== null);
  const valor = partes.reduce((a, b) => a + b, 0) / partes.length;

  return {
    id: "volume",
    nome,
    peso: TECHNICAL_CONFIG.pesos.volume,
    valor,
    explicacao: `${volRel !== null ? `Volume do último pregão é ${volRel.toFixed(2)}x a média de 20 pregões` : "sem volume relativo ainda"}${
      obvScore !== null ? `; OBV ${obvScore >= 50 ? "em acumulação" : "em distribuição"} nos últimos ${JANELA_SLOPE} pregões` : ""
    }.`,
  };
}

function estruturaComponente(
  e: TechnicalEntrada,
  pivots: Pivot[]
): ComponenteResultado {
  const nome = "Estrutura de mercado (topos/fundos)";
  const topos = pivots.filter((p) => p.tipo === "topo");
  const fundos = pivots.filter((p) => p.tipo === "fundo");

  if (topos.length < 2 || fundos.length < 2) {
    return {
      id: "estrutura",
      nome,
      peso: TECHNICAL_CONFIG.pesos.estrutura,
      valor: null,
      explicacao: `Ainda não há topos/fundos suficientes confirmados (${topos.length} topo(s), ${fundos.length} fundo(s)) para classificar estrutura de alta/baixa.`,
    };
  }

  const ultTopos = topos.slice(-2);
  const ultFundos = fundos.slice(-2);
  const hh = ultTopos[1].valor > ultTopos[0].valor;
  const hl = ultFundos[1].valor > ultFundos[0].valor;

  let valor: number;
  let texto: string;
  if (hh && hl) {
    valor = 85;
    texto = "estrutura de alta (topos e fundos ascendentes — higher highs, higher lows)";
  } else if (!hh && !hl) {
    valor = 15;
    texto = "estrutura de baixa (topos e fundos descendentes — lower highs, lower lows)";
  } else {
    valor = 50;
    texto = "estrutura lateral/indefinida (topos e fundos sem direção única — possível mudança de caráter)";
  }

  const resistencia = ultTopos[1].valor;
  const suporte = ultFundos[1].valor;

  return {
    id: "estrutura",
    nome,
    peso: TECHNICAL_CONFIG.pesos.estrutura,
    valor,
    explicacao: `${texto}. Suporte mais recente em ${fmt(suporte)}, resistência mais recente em ${fmt(resistencia)}.`,
  };
}

function rompimentosComponente(e: TechnicalEntrada, pivots: Pivot[]): ComponenteResultado {
  const nome = "Rompimentos (breakout de suporte/resistência)";
  const topos = pivots.filter((p) => p.tipo === "topo");
  const fundos = pivots.filter((p) => p.tipo === "fundo");

  if (topos.length < 1 || fundos.length < 1) {
    return {
      id: "rompimentos",
      nome,
      peso: TECHNICAL_CONFIG.pesos.rompimentos,
      valor: null,
      explicacao: "Sem topo/fundo confirmado ainda para definir uma resistência ou suporte de referência.",
    };
  }

  const resistencia = topos[topos.length - 1].valor;
  const suporte = fundos[fundos.length - 1].valor;
  const closeAtual = e.closes[e.closes.length - 1];
  const volRel = volumeRelativo(e.volumes, 20);
  const confirmadoPorVolume = volRel !== null && volRel >= 1.3;
  const margem = 0.002;

  let valor: number;
  let texto: string;
  if (closeAtual > resistencia * (1 + margem)) {
    valor = confirmadoPorVolume ? 92 : 68;
    texto = `Rompeu a resistência de ${fmt(resistencia)}${
      confirmadoPorVolume ? " com volume acima da média (rompimento confirmado)" : " sem confirmação de volume acima da média (rompimento fraco — pode ser falso ou pedir reteste)"
    }`;
  } else if (closeAtual < suporte * (1 - margem)) {
    valor = confirmadoPorVolume ? 8 : 32;
    texto = `Rompeu o suporte de ${fmt(suporte)}${
      confirmadoPorVolume ? " com volume acima da média (rompimento confirmado)" : " sem confirmação de volume acima da média (rompimento fraco — pode ser falso ou pedir reteste)"
    }`;
  } else {
    valor = 50;
    texto = `Preço dentro do range entre o suporte (${fmt(suporte)}) e a resistência (${fmt(resistencia)}) — sem rompimento`;
  }

  return {
    id: "rompimentos",
    nome,
    peso: TECHNICAL_CONFIG.pesos.rompimentos,
    valor,
    explicacao: `${texto}. Padrões gráficos nomeados (triângulos, bandeiras, OCO, topo/fundo duplo) NÃO são detectados nesta v1 — exigem curadoria visual (ver roadmap/technical-engine-v1.md).`,
  };
}

function timingDe(score: number): Timing {
  if (score >= 80) return "excelente";
  if (score >= 60) return "bom";
  if (score >= 40) return "neutro";
  if (score >= 20) return "ruim";
  return "muito_ruim";
}

export function calcularTechnical(e: TechnicalEntrada): TechnicalResultado {
  const pivots = encontrarPivots(e.maximas, e.minimas, 3);

  const componentes: ComponenteResultado[] = [
    tendenciaComponente(e),
    momentumComponente(e),
    volumeComponente(e),
    estruturaComponente(e, pivots),
    rompimentosComponente(e, pivots),
  ];

  const disponiveis = componentes.filter((c) => c.valor !== null);
  const pesoDisponivel = disponiveis.reduce((a, c) => a + c.peso, 0);

  const score =
    disponiveis.length === 0
      ? null
      : Math.round(disponiveis.reduce((a, c) => a + c.valor! * c.peso, 0) / pesoDisponivel);

  const confianca: "alta" | "media" | "baixa" =
    pesoDisponivel >= 0.7 ? "alta" : pesoDisponivel >= 0.4 ? "media" : "baixa";

  const timing = score !== null ? timingDe(score) : null;
  const fraseTiming = timing !== null ? FRASE_TIMING[timing] : null;

  let teseTecnica: TeseTecnica;
  let explicacaoTese: string;
  if (!e.temTese) {
    teseTecnica = "sem_tese";
    explicacaoTese = "Sem tese fundamentalista registrada para este ticker — a Tese Técnica só avalia se o gráfico confirma uma tese que já existe.";
  } else if (score === null) {
    teseTecnica = "sem_tese";
    explicacaoTese = "Há tese registrada, mas ainda não há dado técnico suficiente para dizer se o gráfico confirma ou não.";
  } else if (score >= 70) {
    teseTecnica = "sim";
    explicacaoTese = `Gráfico confirma a tese (Technical Score ${score}) — ${ROTULO_TIMING[timing!]}. Isso NÃO é uma ordem de compra: os fundamentos continuam decidindo O QUE, o gráfico só ajuda a ler QUANDO.`;
  } else if (score >= 40) {
    teseTecnica = "parcialmente";
    explicacaoTese = `Gráfico confirma parcialmente a tese (Technical Score ${score}) — sinais mistos entre os componentes.`;
  } else {
    teseTecnica = "nao";
    explicacaoTese = `Gráfico NÃO confirma a tese no momento (Technical Score ${score}). Isso não invalida a tese fundamentalista — só sugere que o timing técnico está desfavorável agora.`;
  }

  return {
    score,
    confianca,
    componentesDisponiveis: disponiveis.length,
    componentesTotal: componentes.length,
    componentes,
    timing,
    fraseTiming,
    teseTecnica,
    explicacaoTese,
    versao: TECHNICAL_CONFIG.versaoVigente,
    metodo: `Technical Score v${TECHNICAL_CONFIG.versaoVigente} — média ponderada dos componentes com dado disponível (peso renormalizado; ${
      Object.keys(TECHNICAL_CONFIG.pesos).length
    } componentes na metodologia completa). Só usa candles diários — hierarquia semanal/mensal fica para v2.`,
    barrasDisponiveis: e.closes.length,
    atr14: atr(e.maximas, e.minimas, e.closes, 14),
    bollinger: bollinger(e.closes, 20, 2),
  };
}

export type { ComponenteId };
