/**
 * LEITURA TÉCNICA — funções PURAS sobre a série de fechamentos.
 *
 * Regras de fundação respeitadas:
 * - Descreve o momento do preço; NUNCA emite ordem ("compre/venda" é proibido).
 * - Cada leitura diz o que o indicador é, o valor, e como se lê — em português.
 * - Sem dado suficiente, o indicador fica pendente com o motivo explícito;
 *   o sistema nunca desenha tendência com dado de menos.
 */

export type LeituraTecnica = {
  indicador: string;
  valor: string;
  leitura: string;
  tom: "atencao_positiva" | "atencao_negativa" | "neutro";
};

export type MomentoTecnico = {
  prontos: LeituraTecnica[];
  pendentes: string[]; // ex.: "Média de 50 pregões (precisa de 50; temos 12)"
};

const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Média simples dos últimos n valores. */
function media(valores: number[], n: number): number {
  const fatia = valores.slice(-n);
  return fatia.reduce((a, b) => a + b, 0) / fatia.length;
}

/** RSI de 14 períodos (método de Wilder). Precisa de ≥ 15 fechamentos. */
export function rsi14(fechamentos: number[]): number | null {
  if (fechamentos.length < 15) return null;
  let ganho = 0;
  let perda = 0;
  for (let i = 1; i <= 14; i++) {
    const d = fechamentos[i] - fechamentos[i - 1];
    if (d >= 0) ganho += d;
    else perda -= d;
  }
  let mediaGanho = ganho / 14;
  let mediaPerda = perda / 14;
  for (let i = 15; i < fechamentos.length; i++) {
    const d = fechamentos[i] - fechamentos[i - 1];
    mediaGanho = (mediaGanho * 13 + Math.max(d, 0)) / 14;
    mediaPerda = (mediaPerda * 13 + Math.max(-d, 0)) / 14;
  }
  if (mediaPerda === 0) return 100;
  const rs = mediaGanho / mediaPerda;
  return 100 - 100 / (1 + rs);
}

/**
 * Lê o momento técnico a partir da série de fechamentos EM ORDEM
 * CRONOLÓGICA (do mais antigo para o mais recente).
 */
export function lerMomento(fechamentos: number[]): MomentoTecnico {
  const prontos: LeituraTecnica[] = [];
  const pendentes: string[] = [];
  const n = fechamentos.length;
  const ultimo = n > 0 ? fechamentos[n - 1] : null;

  // ---- RSI 14 ----
  const rsi = rsi14(fechamentos);
  if (rsi !== null) {
    prontos.push({
      indicador: "RSI (força do movimento, 14 pregões)",
      valor: rsi.toFixed(0),
      leitura:
        rsi >= 70
          ? "zona de euforia: o preço subiu rápido demais — historicamente pede cautela e paciência"
          : rsi <= 30
            ? "zona de esgotamento: a queda está esticada — SE os fundamentos seguem de pé, é hora de estudar com calma"
            : "faixa neutra: sem excesso de otimismo nem de pessimismo no preço",
      tom: rsi >= 70 ? "atencao_negativa" : rsi <= 30 ? "atencao_positiva" : "neutro",
    });
  } else {
    pendentes.push(`RSI (precisa de 15 pregões; temos ${n})`);
  }

  // ---- tendência vs média de 50 pregões ----
  if (n >= 50 && ultimo !== null) {
    const m50 = media(fechamentos, 50);
    const dist = (ultimo - m50) / m50;
    prontos.push({
      indicador: "Tendência (preço vs média de 50 pregões)",
      valor: `${dist >= 0 ? "+" : ""}${pct(dist)}`,
      leitura:
        dist >= 0
          ? "preço acima da média dos últimos ~2 meses e meio — tendência de curto prazo construtiva"
          : "preço abaixo da média dos últimos ~2 meses e meio — tendência de curto prazo pressionada",
      tom: Math.abs(dist) < 0.02 ? "neutro" : dist > 0 ? "atencao_positiva" : "atencao_negativa",
    });
  } else {
    pendentes.push(`Tendência 50 pregões (precisa de 50; temos ${n})`);
  }

  // ---- distância da máxima recente ----
  if (n >= 20 && ultimo !== null) {
    const janela = fechamentos.slice(-60);
    const maxima = Math.max(...janela);
    const queda = maxima > 0 ? (maxima - ultimo) / maxima : 0;
    prontos.push({
      indicador: `Distância da máxima (${janela.length} pregões)`,
      valor: `-${pct(queda)}`,
      leitura:
        queda >= 0.15
          ? "bem abaixo da máxima recente — desconto relevante que merece conferência dos fundamentos"
          : queda >= 0.05
            ? "recuo moderado em relação à máxima recente"
            : "rodando perto da máxima recente",
      tom: queda >= 0.15 ? "atencao_positiva" : "neutro",
    });
  } else {
    pendentes.push(`Distância da máxima (precisa de 20 pregões; temos ${n})`);
  }

  // ---- variação em 20 pregões (~1 mês) ----
  if (n >= 21 && ultimo !== null) {
    const base = fechamentos[n - 21];
    const varr = base > 0 ? (ultimo - base) / base : 0;
    prontos.push({
      indicador: "Variação em 20 pregões (~1 mês)",
      valor: `${varr >= 0 ? "+" : ""}${pct(varr)}`,
      leitura:
        Math.abs(varr) < 0.03
          ? "praticamente de lado no último mês"
          : varr > 0
            ? "mês de alta para o papel"
            : "mês de queda para o papel",
      tom: "neutro",
    });
  } else {
    pendentes.push(`Variação de 1 mês (precisa de 21 pregões; temos ${n})`);
  }

  return { prontos, pendentes };
}
