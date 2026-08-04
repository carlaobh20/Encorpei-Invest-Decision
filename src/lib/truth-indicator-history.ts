/**
 * INDICATOR HISTORY (Bloco 2, Sprint 2.4, Módulo 6 — Truth Layer, parcial).
 *
 * A spec pede histórico para Carry/ROIC/Margem/Receita/Lucro/FCF/P-L/
 * EV-EBITDA/P-VP/Dividend Yield. Corte honesto, checado ANTES de prometer
 * (mesmo achado da Sprint 2.3 sobre Valuation): metade desses indicadores
 * tem série real persistida hoje; a outra metade não tem — não fabrico
 * histórico nenhum pra quem não tem.
 *
 * Este arquivo é o registro de COBERTURA (o que tem série e o que não
 * tem), não o motor que lê a série em si — quem lê fundamentos/carry_score/
 * scores por competência já existe em outros arquivos (empresa-forecast-
 * dados.ts, thesis-replay-dados.ts) e continua sendo a fonte real.
 */

export type CoberturaIndicador = {
  indicador: string;
  rotulo: string;
  temHistoricoPersistido: boolean;
  tabela: string | null;
  frequencia: string | null;
  motivoAusencia: string | null;
};

export const COBERTURA_INDICADORES: CoberturaIndicador[] = [
  { indicador: "nota_oficial", rotulo: "Nota oficial (Score Final)", temHistoricoPersistido: true, tabela: "scores", frequencia: "diária", motivoAusencia: null },
  { indicador: "carry", rotulo: "Carry real (v1)", temHistoricoPersistido: true, tabela: "carry_score", frequencia: "diária", motivoAusencia: null },
  { indicador: "receita", rotulo: "Receita líquida", temHistoricoPersistido: true, tabela: "fundamentos", frequencia: "trimestral/anual (DFP/ITR)", motivoAusencia: null },
  { indicador: "margem", rotulo: "Margem líquida", temHistoricoPersistido: true, tabela: "fundamentos", frequencia: "trimestral/anual (DFP/ITR)", motivoAusencia: null },
  { indicador: "roic", rotulo: "ROIC", temHistoricoPersistido: true, tabela: "fundamentos", frequencia: "trimestral/anual (DFP/ITR)", motivoAusencia: null },
  { indicador: "lucro", rotulo: "Lucro líquido", temHistoricoPersistido: true, tabela: "fundamentos", frequencia: "trimestral/anual (DFP/ITR)", motivoAusencia: null },
  {
    indicador: "fcf",
    rotulo: "Fluxo de caixa livre (FCF)",
    temHistoricoPersistido: false,
    tabela: null,
    frequencia: null,
    motivoAusencia: "O cálculo existe (carry/v3-cash.ts, compounder/*) mas não achei série persistida isolada e reutilizável por ticker no tempo.",
  },
  {
    indicador: "p_l",
    rotulo: "P/L",
    temHistoricoPersistido: false,
    tabela: null,
    frequencia: null,
    motivoAusencia: "Cálculo existe sob demanda (radar.ts/score.ts) mas não é persistido como série diária/periódica.",
  },
  {
    indicador: "ev_ebitda",
    rotulo: "EV/EBITDA",
    temHistoricoPersistido: false,
    tabela: null,
    frequencia: null,
    motivoAusencia: "Mesmo motivo do P/L — calculado sob demanda, não persistido como série.",
  },
  {
    indicador: "p_vp",
    rotulo: "P/VP",
    temHistoricoPersistido: false,
    tabela: null,
    frequencia: null,
    motivoAusencia: "Mesmo motivo do P/L — calculado sob demanda, não persistido como série.",
  },
  {
    indicador: "dividend_yield",
    rotulo: "Dividend Yield",
    temHistoricoPersistido: false,
    tabela: null,
    frequencia: null,
    motivoAusencia: "Granularidade de pagamento individual de dividendos/JCP não confirmada (mesma pendência da Memory Layer, Coletor 5).",
  },
  {
    indicador: "confluence",
    rotulo: "Confluence Score (Decision Object v2)",
    temHistoricoPersistido: false,
    tabela: null,
    frequencia: null,
    motivoAusencia: "Decision Object nunca foi persistido em snapshot diário — só a nota oficial (scores) tem série real.",
  },
];

export function indicadoresComHistorico(lista: CoberturaIndicador[] = COBERTURA_INDICADORES): CoberturaIndicador[] {
  return lista.filter((i) => i.temHistoricoPersistido);
}

export function indicadoresSemHistorico(lista: CoberturaIndicador[] = COBERTURA_INDICADORES): CoberturaIndicador[] {
  return lista.filter((i) => !i.temHistoricoPersistido);
}

export type ResumoCoberturaHistorico = {
  total: number;
  comHistorico: number;
  semHistorico: number;
  percentualCobertura: number;
};

export function resumirCoberturaHistorico(lista: CoberturaIndicador[] = COBERTURA_INDICADORES): ResumoCoberturaHistorico {
  const comHistorico = indicadoresComHistorico(lista).length;
  return {
    total: lista.length,
    comHistorico,
    semHistorico: lista.length - comHistorico,
    percentualCobertura: lista.length === 0 ? 0 : Math.round((comHistorico / lista.length) * 100),
  };
}
