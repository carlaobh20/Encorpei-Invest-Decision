/**
 * SECTOR INTELLIGENCE — classificação por MODELO DE ANÁLISE.
 *
 * Princípio: cada modelo de negócio tem indicadores que fazem sentido e
 * indicadores que são RUÍDO (banco não tem "dívida líquida"; seguradora
 * não tem EBITDA). Nenhuma empresa é analisada sem modelo identificado.
 * Metadado determinístico e versionado (git); migração 013 o levará ao
 * banco quando o score setorial (nova versao_algoritmo) for ligado.
 */

export type ModeloAnalise =
  | "industrial"
  | "banco"
  | "seguradora"
  | "eletrica_utility"
  | "varejo"
  | "software"
  | "saude"
  | "commodities"
  | "construcao"
  | "telecom"
  | "shopping_imobiliario"
  | "infraestrutura_financeira"
  | "holding_consumo";

export const MODELO_POR_TICKER: Record<string, ModeloAnalise> = {
  // industriais / bens de capital
  WEGE3: "industrial", INTB3: "industrial",
  // infraestrutura financeira (bolsa não é banco)
  B3SA3: "infraestrutura_financeira",
  // bancos
  ITUB4: "banco", BBDC4: "banco", BBAS3: "banco",
  // seguradoras
  PSSA3: "seguradora", BBSE3: "seguradora", CXSE3: "seguradora",
  // consumo / bebidas
  ABEV3: "holding_consumo",
  // software
  TOTS3: "software",
  // varejo
  LREN3: "varejo", MGLU3: "varejo", RADL3: "varejo",
  // saúde
  FLRY3: "saude", HAPV3: "saude", RDOR3: "saude", HYPE3: "saude",
  // elétricas / utilities
  EGIE3: "eletrica_utility", CPLE3: "eletrica_utility", AXIA3: "eletrica_utility",
  EQTL3: "eletrica_utility", TAEE11: "eletrica_utility", SBSP3: "eletrica_utility",
  // commodities / materiais
  VALE3: "commodities", PETR4: "commodities", PRIO3: "commodities",
  GGBR4: "commodities", SUZB3: "commodities", KLBN11: "commodities",
  SLCE3: "commodities", SMTO3: "commodities",
  // combustíveis/distribuição
  UGPA3: "holding_consumo", VBBR3: "holding_consumo",
  // construção
  CYRE3: "construcao", EZTC3: "construcao",
  // shoppings / imobiliário
  MULT3: "shopping_imobiliario",
  // telecom
  VIVT3: "telecom", TIMS3: "telecom",
  // mobilidade (frota = intensivo em capital → industrial)
  RENT3: "industrial",
};

export const ROTULO_MODELO: Record<ModeloAnalise, string> = {
  industrial: "Industrial",
  banco: "Banco",
  seguradora: "Seguradora",
  eletrica_utility: "Elétrica/Utility",
  varejo: "Varejo",
  software: "Software",
  saude: "Saúde",
  commodities: "Commodities",
  construcao: "Construção",
  telecom: "Telecom",
  shopping_imobiliario: "Shoppings/Imobiliário",
  infraestrutura_financeira: "Infra financeira",
  holding_consumo: "Consumo",
};

/**
 * Indicadores EXCLUÍDOS por modelo — regra dura, testada no CI.
 * (nomes internos: roic, divida_liquida, alavancagem, ebitda*)
 * *ebitda ainda nem é coletado; a exclusão já nasce escrita.
 */
export const INDICADORES_EXCLUIDOS: Record<ModeloAnalise, string[]> = {
  banco: ["roic", "divida_liquida", "alavancagem", "ebitda", "liquidez_corrente"],
  seguradora: ["roic", "divida_liquida", "alavancagem", "ebitda"],
  infraestrutura_financeira: [],
  industrial: [],
  eletrica_utility: [],
  varejo: [],
  software: [],
  saude: [],
  commodities: [],
  construcao: [],
  telecom: [],
  shopping_imobiliario: [],
  holding_consumo: [],
};

export function modeloDe(ticker: string): ModeloAnalise | null {
  return MODELO_POR_TICKER[ticker] ?? null;
}

export function indicadorPermitido(ticker: string, indicador: string): boolean {
  const m = modeloDe(ticker);
  if (!m) return true;
  return !INDICADORES_EXCLUIDOS[m].includes(indicador);
}
