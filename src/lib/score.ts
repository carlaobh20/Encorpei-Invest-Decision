/**
 * DECISION ENGINE v1 — funções PURAS de pontuação.
 * Regra de fundação: a IA nunca dá nota. Estas faixas espelham a
 * versao_algoritmo=1 gravada no banco; mudou faixa aqui = nova versão lá.
 */

export type RegraAplicada = {
  componente: "qualidade" | "valuation" | "risco";
  regra: string;
  valor: string;
  pontos: number;
};

export type ResultadoScore = {
  qualidade: number | null;
  valuation: number | null;
  risco: number | null;
  score_final: number;
  confianca: "alta" | "media" | "baixa";
  decomposicao: RegraAplicada[];
};

const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

function ptsRoic(r: number): number {
  if (r >= 0.2) return 100;
  if (r >= 0.12) return 60 + ((r - 0.12) / 0.08) * 40;
  if (r >= 0.08) return 40 + ((r - 0.08) / 0.04) * 20;
  return Math.max(0, (r / 0.08) * 40);
}

function ptsMargem(m: number): number {
  if (m >= 0.2) return 100;
  if (m >= 0.1) return 60 + ((m - 0.1) / 0.1) * 40;
  if (m >= 0.03) return 30 + ((m - 0.03) / 0.07) * 30;
  return Math.max(0, (m / 0.03) * 30);
}

function ptsBalanco(divida: number, pl: number): number {
  if (divida <= 0) return 100;
  if (pl <= 0) return 10;
  const alav = divida / pl;
  if (alav <= 0.5) return 70;
  if (alav <= 1) return 50;
  if (alav <= 2) return 30;
  return 10;
}

function ptsValuation(earningsYield: number): number {
  if (earningsYield < 0) return 10;
  if (earningsYield >= 0.12) return 100;
  if (earningsYield >= 0.08) return 70 + ((earningsYield - 0.08) / 0.04) * 30;
  if (earningsYield >= 0.05) return 40 + ((earningsYield - 0.05) / 0.03) * 30;
  return (earningsYield / 0.05) * 40;
}

function ptsEstabilidade(desvioMargem: number): number {
  if (desvioMargem <= 0.02) return 100;
  if (desvioMargem <= 0.05) return 70;
  if (desvioMargem <= 0.1) return 40;
  return 20;
}

export function calcularScore(entrada: {
  roic: number | null;
  margem_liquida: number | null;
  divida_liquida: number | null;
  patrimonio_liquido: number | null;
  lucro_ltm: number | null;
  market_cap: number | null;
  margens_trimestrais: number[]; // últimas margens (cvm_itr)
}): ResultadoScore {
  const dec: RegraAplicada[] = [];

  // ---------- QUALIDADE ----------
  const q: number[] = [];
  if (entrada.roic !== null) {
    const p = ptsRoic(entrada.roic);
    q.push(p);
    dec.push({
      componente: "qualidade",
      regra: "Retorno sobre o capital (ROIC)",
      valor: pct(entrada.roic),
      pontos: Math.round(p),
    });
  }
  if (entrada.margem_liquida !== null) {
    const p = ptsMargem(entrada.margem_liquida);
    q.push(p);
    dec.push({
      componente: "qualidade",
      regra: "Margem líquida",
      valor: pct(entrada.margem_liquida),
      pontos: Math.round(p),
    });
  }
  if (entrada.divida_liquida !== null && entrada.patrimonio_liquido !== null) {
    const p = ptsBalanco(entrada.divida_liquida, entrada.patrimonio_liquido);
    q.push(p);
    dec.push({
      componente: "qualidade",
      regra: "Solidez do balanço (dívida vs patrimônio)",
      valor:
        entrada.divida_liquida <= 0
          ? "caixa líquido"
          : `dívida = ${pct(entrada.divida_liquida / entrada.patrimonio_liquido)} do patrimônio`,
      pontos: Math.round(p),
    });
  }
  const qualidade = q.length ? q.reduce((a, b) => a + b, 0) / q.length : null;

  // ---------- VALUATION ----------
  let valuation: number | null = null;
  if (
    entrada.lucro_ltm !== null &&
    entrada.market_cap !== null &&
    entrada.market_cap > 0
  ) {
    const ey = entrada.lucro_ltm / entrada.market_cap;
    valuation = ptsValuation(ey);
    dec.push({
      componente: "valuation",
      regra: "Rendimento do lucro (lucro 12m ÷ valor de mercado)",
      valor: pct(ey),
      pontos: Math.round(valuation),
    });
  }

  // ---------- RISCO ----------
  const r: number[] = [];
  if (entrada.divida_liquida !== null && entrada.patrimonio_liquido !== null) {
    const p = ptsBalanco(entrada.divida_liquida, entrada.patrimonio_liquido);
    r.push(p);
    dec.push({
      componente: "risco",
      regra: "Alavancagem",
      valor:
        entrada.divida_liquida <= 0
          ? "caixa líquido"
          : `dívida = ${pct(entrada.divida_liquida / entrada.patrimonio_liquido)} do patrimônio`,
      pontos: Math.round(p),
    });
  }
  if (entrada.margens_trimestrais.length >= 3) {
    const ms = entrada.margens_trimestrais;
    const media = ms.reduce((a, b) => a + b, 0) / ms.length;
    const sd = Math.sqrt(
      ms.reduce((a, b) => a + (b - media) ** 2, 0) / ms.length
    );
    const p = ptsEstabilidade(sd);
    r.push(p);
    dec.push({
      componente: "risco",
      regra: "Estabilidade das margens (últimos trimestres)",
      valor: `oscilação de ${pct(sd)}`,
      pontos: Math.round(p),
    });
  }
  const risco = r.length ? r.reduce((a, b) => a + b, 0) / r.length : null;

  // ---------- FINAL (pesos v1, renormalizados pelos presentes) ----------
  const pesos: [number | null, number][] = [
    [qualidade, 0.4],
    [valuation, 0.3],
    [risco, 0.3],
  ];
  const presentes = pesos.filter(([v]) => v !== null) as [number, number][];
  const somaPesos = presentes.reduce((a, [, w]) => a + w, 0);
  const score_final = presentes.length
    ? presentes.reduce((a, [v, w]) => a + v * (w / somaPesos), 0)
    : 0;

  const nComp = presentes.length;
  const confianca: ResultadoScore["confianca"] =
    nComp === 3 ? "alta" : nComp === 2 ? "media" : "baixa";

  return {
    qualidade: qualidade !== null ? Math.round(qualidade) : null,
    valuation: valuation !== null ? Math.round(valuation) : null,
    risco: risco !== null ? Math.round(risco) : null,
    score_final: Math.round(score_final),
    confianca,
    decomposicao: dec,
  };
}
