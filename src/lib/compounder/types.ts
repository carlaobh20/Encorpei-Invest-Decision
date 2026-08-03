/**
 * ENCORPEI COMPOUNDER ENGINE — tipos e contrato.
 *
 * Categoria PRÓPRIA, nunca misturada com Value/Dividendos/Carry (regra do
 * Carlos). Pergunta que este motor responde: qual empresa tem mais
 * capacidade de MULTIPLICAR patrimônio nos próximos anos, mantendo
 * qualidade — não "cresce", "multiplica".
 *
 * Princípio inegociável (igual ao Carry): componente sem dado suficiente
 * NUNCA vira estimativa. Ele fica DE FORA e o peso é renormalizado entre
 * os componentes que TÊM dado — nunca um número secreto no lugar do buraco.
 * `componentesDisponiveis` sempre mostra quantos dos 8 entraram de verdade.
 */

export type DirecaoFator = "sustenta" | "atencao";

export type FatorCompounder = {
  texto: string;
  direcao: DirecaoFator;
};

export type ComponenteId =
  | "growth_quality"
  | "roic"
  | "reinvestimento"
  | "fcf"
  | "margens"
  | "gestao"
  | "runway"
  | "diluicao";

export type ComponenteResultado = {
  id: ComponenteId;
  nome: string;
  peso: number; // 0..1, soma dos 8 = 1
  /** 0..100, null = sem dado suficiente (nunca estimado) */
  valor: number | null;
  explicacao: string;
};

export type CompounderResultado = {
  /** 0..100, null = nenhum componente com dado suficiente */
  score: number | null;
  confianca: "alta" | "media" | "baixa";
  /** quantos dos 8 componentes entraram com dado real */
  componentesDisponiveis: number;
  componentesTotal: number;
  componentes: ComponenteResultado[];
  fatores: FatorCompounder[];
  versao: number;
  metodo: string;
};

export type CompounderEntrada = {
  ticker: string;

  // --- growth quality ---
  /** receita do último exercício anual fechado (DFP) */
  receitaAnoAtual: number | null;
  /** receita do exercício anterior (DFP) — só dá para comparar 1 ano por enquanto */
  receitaAnoAnterior: number | null;
  lucroAnoAtual: number | null;
  lucroAnoAnterior: number | null;

  // --- roic ---
  roic4tri: number | null;

  // --- reinvestimento (DFC) ---
  lucroLtm: number | null;
  dividendosJcpLtm: number | null;

  // --- fcf (DFC) ---
  caixaOperacionalLtm: number | null;
  capexLtm: number | null;
  marketCap: number | null;

  // --- margens (trimestres disponíveis, mais recente primeiro) ---
  margensTrimestrais: number[];

  // --- diluição (DFC) ---
  recomprasLtm: number | null;

  // --- contexto ---
  ehFinanceira: boolean;
};

export const COMPOUNDER_CONFIG = {
  versaoVigente: 1,
  pesos: {
    growth_quality: 0.25,
    roic: 0.2,
    reinvestimento: 0.15,
    fcf: 0.15,
    margens: 0.1,
    gestao: 0.05,
    runway: 0.05,
    diluicao: 0.05,
  } as Record<ComponenteId, number>,
} as const;
