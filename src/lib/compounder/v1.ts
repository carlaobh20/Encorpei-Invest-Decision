import {
  COMPOUNDER_CONFIG,
  type ComponenteId,
  type ComponenteResultado,
  type CompounderEntrada,
  type CompounderResultado,
  type FatorCompounder,
} from "./types";

/**
 * COMPOUNDER ENGINE v1.
 *
 * Metodologia documentada em roadmap/compounder-engine-v1.md. Resumo do
 * corte honesto desta v1: o sistema só tem ~2 anos de DFP coletados (2024 e
 * 2025) — então "CAGR de 3/5/10 anos" da spec original vira, por enquanto,
 * "crescimento de 1 ano" (rotulado assim, nunca disfarçado de CAGR longo).
 * Gestão e Runway ficam NULOS nesta v1 — a própria spec pede curadoria
 * manual para Runway, e Gestão não tem proxy honesto com o dado disponível
 * hoje. O peso desses componentes é renormalizado entre os que TÊM dado.
 */

/** Interpolação linear por faixas — mesmo mapeamento documentado em todo componente. */
function mapaFaixas(valor: number, pontos: [number, number][]): number {
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

function growthQuality(e: CompounderEntrada): ComponenteResultado {
  const nome = "Growth Quality (crescimento de 1 ano — ainda sem CAGR 3/5/10 anos)";
  const temReceita =
    e.receitaAnoAtual !== null && e.receitaAnoAnterior !== null && e.receitaAnoAnterior > 0;
  const temLucro =
    e.lucroAnoAtual !== null && e.lucroAnoAnterior !== null && e.lucroAnoAnterior > 0;
  if (!temReceita && !temLucro) {
    return {
      id: "growth_quality",
      nome,
      peso: COMPOUNDER_CONFIG.pesos.growth_quality,
      valor: null,
      explicacao: "Sem dois anos de receita/lucro fechados para comparar ainda — aguarda mais coleta.",
    };
  }
  const faixas: [number, number][] = [
    [-0.1, 0],
    [0, 40],
    [0.1, 70],
    [0.25, 90],
    [0.5, 100],
  ];
  const scoreReceita = temReceita
    ? mapaFaixas(e.receitaAnoAtual! / e.receitaAnoAnterior! - 1, faixas)
    : null;
  const scoreLucro = temLucro ? mapaFaixas(e.lucroAnoAtual! / e.lucroAnoAnterior! - 1, faixas) : null;
  const partes = [scoreReceita, scoreLucro].filter((v): v is number => v !== null);
  const valor = partes.reduce((a, b) => a + b, 0) / partes.length;
  const crescR = temReceita ? `receita ${pct(e.receitaAnoAtual! / e.receitaAnoAnterior! - 1)}` : "receita sem dado";
  const crescL = temLucro ? `lucro ${pct(e.lucroAnoAtual! / e.lucroAnoAnterior! - 1)}` : "lucro sem dado";
  return {
    id: "growth_quality",
    nome,
    peso: COMPOUNDER_CONFIG.pesos.growth_quality,
    valor,
    explicacao: `Crescimento do último exercício fechado vs. o anterior: ${crescR}, ${crescL}. Ainda não é CAGR de vários anos — o histórico coletado não chega lá.`,
  };
}

function roicComponente(e: CompounderEntrada): ComponenteResultado {
  const nome = "ROIC (média 4 trimestres)";
  if (e.roic4tri === null || e.ehFinanceira) {
    return {
      id: "roic",
      nome,
      peso: COMPOUNDER_CONFIG.pesos.roic,
      valor: null,
      explicacao: e.ehFinanceira
        ? "ROIC não se aplica ao modelo de negócio (banco/seguradora) — mesma regra do Sector Intelligence."
        : "Sem ROIC de 4 trimestres calculável ainda.",
    };
  }
  const faixas: [number, number][] = [
    [0, 0],
    [0.08, 35],
    [0.15, 60],
    [0.25, 85],
    [0.35, 100],
  ];
  return {
    id: "roic",
    nome,
    peso: COMPOUNDER_CONFIG.pesos.roic,
    valor: mapaFaixas(e.roic4tri, faixas),
    explicacao: `ROIC médio dos últimos 4 trimestres: ${pct(e.roic4tri)}.`,
  };
}

function reinvestimento(e: CompounderEntrada): ComponenteResultado {
  const nome = "Capacidade de Reinvestimento (retenção do lucro)";
  if (e.lucroLtm === null || e.lucroLtm <= 0 || e.dividendosJcpLtm === null || e.dividendosJcpLtm === undefined) {
    return {
      id: "reinvestimento",
      nome,
      peso: COMPOUNDER_CONFIG.pesos.reinvestimento,
      valor: null,
      explicacao: "Aguarda lucro positivo e dividendos/JCP pagos (DFC oficial) para medir quanto fica dentro da empresa.",
    };
  }
  const payout = Math.min(Math.max(Math.abs(e.dividendosJcpLtm) / e.lucroLtm, 0), 1);
  const retencao = 1 - payout;
  const faixas: [number, number][] = [
    [0, 30],
    [0.3, 50],
    [0.6, 75],
    [0.85, 95],
    [1, 100],
  ];
  return {
    id: "reinvestimento",
    nome,
    peso: COMPOUNDER_CONFIG.pesos.reinvestimento,
    valor: mapaFaixas(retencao, faixas),
    explicacao: `Retém ${pct(retencao)} do lucro dentro da empresa (payout de ${pct(payout)}, medido na DFC oficial). Mede CAPACIDADE de reinvestir — se o reinvestimento é bem aplicado, isso já está no componente de ROIC.`,
  };
}

function fcfComponente(e: CompounderEntrada): ComponenteResultado {
  const nome = "Crescimento e Qualidade do Fluxo de Caixa";
  if (
    e.caixaOperacionalLtm === null ||
    e.caixaOperacionalLtm === undefined ||
    e.capexLtm === null ||
    e.capexLtm === undefined
  ) {
    return {
      id: "fcf",
      nome,
      peso: COMPOUNDER_CONFIG.pesos.fcf,
      valor: null,
      explicacao: "Aguarda caixa operacional e capex (DFC oficial) para calcular o fluxo de caixa livre.",
    };
  }
  const fcf = e.caixaOperacionalLtm - Math.abs(e.capexLtm);
  const yieldFaixas: [number, number][] = [
    [0, 20],
    [0.03, 45],
    [0.06, 65],
    [0.1, 85],
    [0.15, 100],
  ];
  const scoreYield =
    e.marketCap !== null && e.marketCap > 0 ? mapaFaixas(Math.max(fcf, 0) / e.marketCap, yieldFaixas) : null;
  const convFaixas: [number, number][] = [
    [0, 20],
    [0.5, 50],
    [0.75, 70],
    [1, 90],
    [1.3, 100],
  ];
  const scoreConversao =
    e.lucroLtm !== null && e.lucroLtm > 0 ? mapaFaixas(Math.max(fcf, 0) / e.lucroLtm, convFaixas) : null;
  const partes = [scoreYield, scoreConversao].filter((v): v is number => v !== null);
  if (partes.length === 0) {
    return {
      id: "fcf",
      nome,
      peso: COMPOUNDER_CONFIG.pesos.fcf,
      valor: null,
      explicacao: "FCF calculado, mas falta valor de mercado ou lucro para converter em nota comparável.",
    };
  }
  const valor = partes.reduce((a, b) => a + b, 0) / partes.length;
  return {
    id: "fcf",
    nome,
    peso: COMPOUNDER_CONFIG.pesos.fcf,
    valor,
    explicacao: `FCF (caixa operacional − capex) dos últimos 12 meses: ${fmt(fcf)}. Ainda é foto de 1 ano — falta histórico para medir CRESCIMENTO do FCF ao longo de anos.`,
  };
}

function margensComponente(e: CompounderEntrada): ComponenteResultado {
  const nome = "Expansão de Margens";
  const serie = e.margensTrimestrais.filter((m) => typeof m === "number");
  if (serie.length < 2) {
    return {
      id: "margens",
      nome,
      peso: COMPOUNDER_CONFIG.pesos.margens,
      valor: null,
      explicacao: "Menos de 2 trimestres de margem coletados — ainda não dá para falar em expansão ou contração.",
    };
  }
  const maisRecente = serie[0];
  const maisAntiga = serie[serie.length - 1];
  const delta = maisRecente - maisAntiga;
  const faixas: [number, number][] = [
    [-0.05, 15],
    [-0.02, 40],
    [0, 55],
    [0.02, 75],
    [0.05, 95],
    [0.1, 100],
  ];
  return {
    id: "margens",
    nome,
    peso: COMPOUNDER_CONFIG.pesos.margens,
    valor: mapaFaixas(delta, faixas),
    explicacao: `Margem líquida foi de ${pct(maisAntiga)} para ${pct(maisRecente)} em ${serie.length} trimestres coletados (janela curta — não é histórico de anos ainda).`,
  };
}

function gestaoComponente(): ComponenteResultado {
  return {
    id: "gestao",
    nome: "Qualidade da Gestão",
    peso: COMPOUNDER_CONFIG.pesos.gestao,
    valor: null,
    explicacao:
      "Sem proxy honesto com o dado disponível hoje (alocação de capital histórica, M&A, execução) — exige curadoria qualitativa, como as teses. Fica nulo até o Carlos (ou um processo formal) registrar isso por empresa.",
  };
}

function runwayComponente(): ComponenteResultado {
  return {
    id: "runway",
    nome: "Runway de Crescimento",
    peso: COMPOUNDER_CONFIG.pesos.runway,
    valor: null,
    explicacao:
      "Por definição desta v1 (mercado endereçável, espaço de expansão, internacionalização): começa manual/documentado, como a própria especificação pediu. Nenhum número aqui até existir curadoria.",
  };
}

function diluicaoComponente(e: CompounderEntrada): ComponenteResultado {
  const nome = "Diluição (sinal parcial: recompras)";
  if (e.recomprasLtm === null || e.recomprasLtm === undefined) {
    return {
      id: "diluicao",
      nome,
      peso: COMPOUNDER_CONFIG.pesos.diluicao,
      valor: null,
      explicacao: "Sem dado de recompras (DFC) para este período ainda.",
    };
  }
  // convenção da DFC (financiamento, 6.03): saída de caixa vem negativa —
  // recompra real de ações é um NÚMERO NEGATIVO aqui, igual dividendos pagos.
  const houveRecompra = e.recomprasLtm < 0;
  const recompraYield = e.marketCap && e.marketCap > 0 ? Math.abs(e.recomprasLtm) / e.marketCap : 0;
  const valor = houveRecompra ? mapaFaixas(recompraYield, [[0, 55], [0.01, 70], [0.03, 90], [0.06, 100]]) : 45;
  return {
    id: "diluicao",
    nome,
    peso: COMPOUNDER_CONFIG.pesos.diluicao,
    valor,
    explicacao: houveRecompra
      ? `Recomprou ações nos últimos 12 meses (sinal anti-diluição) — ${fmt(Math.abs(e.recomprasLtm))}.`
      : "Sem recompra detectada no período. IMPORTANTE: o sistema ainda não rastreia histórico de EMISSÃO de ações (o número de ações é sobrescrito a cada coleta, sem versão) — então isto NÃO confirma diluição real, só a ausência do sinal positivo de recompra.",
  };
}

export function calcularCompounder(e: CompounderEntrada): CompounderResultado {
  const componentes: ComponenteResultado[] = [
    growthQuality(e),
    roicComponente(e),
    reinvestimento(e),
    fcfComponente(e),
    margensComponente(e),
    gestaoComponente(),
    runwayComponente(),
    diluicaoComponente(e),
  ];

  const disponiveis = componentes.filter((c) => c.valor !== null);
  const pesoDisponivel = disponiveis.reduce((a, c) => a + c.peso, 0);

  const score =
    disponiveis.length === 0
      ? null
      : Math.round(disponiveis.reduce((a, c) => a + c.valor! * c.peso, 0) / pesoDisponivel);

  const confianca: "alta" | "media" | "baixa" =
    pesoDisponivel >= 0.7 ? "alta" : pesoDisponivel >= 0.4 ? "media" : "baixa";

  const fatores: FatorCompounder[] = componentes
    .filter((c) => c.valor !== null)
    .map((c) => ({
      texto: `${c.nome}: ${Math.round(c.valor!)}/100 — ${c.explicacao}`,
      direcao: c.valor! >= 60 ? "sustenta" : "atencao",
    }));

  return {
    score,
    confianca,
    componentesDisponiveis: disponiveis.length,
    componentesTotal: componentes.length,
    componentes,
    fatores,
    versao: COMPOUNDER_CONFIG.versaoVigente,
    metodo: `Compounder Score v${COMPOUNDER_CONFIG.versaoVigente} — média ponderada dos componentes com dado disponível (peso renormalizado; ${Object.keys(
      COMPOUNDER_CONFIG.pesos
    ).length} componentes na metodologia completa).`,
  };
}

function pct(v: number): string {
  return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

export type { ComponenteId };
