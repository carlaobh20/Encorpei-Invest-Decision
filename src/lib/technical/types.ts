/**
 * ENCORPEI TECHNICAL INTELLIGENCE ENGINE — tipos e contrato.
 *
 * Filosofia (do próprio Carlos): o Encorpei NÃO é um software de análise
 * técnica nem de análise fundamentalista sozinhos — é um software de
 * DECISÃO. Os fundamentos continuam determinando O QUE comprar. O gráfico
 * determina QUANDO. O gráfico NUNCA aprova uma empresa ruim, e a IA NUNCA
 * diz "compre" — só "Momento Favorável / Desfavorável / Aguardar melhor
 * ponto" (regra de linguagem neutra do CLAUDE.md, seção 7).
 *
 * Mesmo princípio de corte honesto do Carry/Compounder: componente sem
 * dado suficiente fica NULO e o peso é renormalizado — nunca um número
 * estimado no lugar de um buraco.
 */

export type ComponenteId = "tendencia" | "momentum" | "volume" | "estrutura" | "rompimentos";

export type ComponenteResultado = {
  id: ComponenteId;
  nome: string;
  peso: number; // 0..1, soma dos 5 = 1
  /** 0..100 — 0 = viés de baixa forte, 50 = neutro, 100 = viés de alta forte. null = sem dado suficiente. */
  valor: number | null;
  explicacao: string;
};

export type Timing = "excelente" | "bom" | "neutro" | "ruim" | "muito_ruim";

export const ROTULO_TIMING: Record<Timing, string> = {
  excelente: "Excelente",
  bom: "Bom",
  neutro: "Neutro",
  ruim: "Ruim",
  muito_ruim: "Muito ruim",
};

/** Nunca "Compre"/"Venda" — regra de linguagem neutra (CLAUDE.md §7). */
export const FRASE_TIMING: Record<Timing, string> = {
  excelente: "Momento Favorável",
  bom: "Momento Favorável",
  neutro: "Aguardar melhor ponto",
  ruim: "Momento Desfavorável",
  muito_ruim: "Momento Desfavorável",
};

export type TeseTecnica = "sim" | "parcialmente" | "nao" | "sem_tese";

export type TechnicalResultado = {
  /** 0..100, null = nenhum componente com dado suficiente */
  score: number | null;
  confianca: "alta" | "media" | "baixa";
  componentesDisponiveis: number;
  componentesTotal: number;
  componentes: ComponenteResultado[];
  timing: Timing | null;
  fraseTiming: string | null;
  teseTecnica: TeseTecnica;
  /** "o gráfico confirma a tese?" — texto, nunca instrução de ordem */
  explicacaoTese: string;
  versao: number;
  metodo: string;
  barrasDisponiveis: number;
  /**
   * Volatilidade — INFORMATIVA nesta v1, ainda FORA do Technical Score
   * (corte honesto: ATR/Bollinger ajudam a ler o gráfico, mas ainda não
   * foram calibrados como componente de nota — ver roadmap/technical-engine-v1.md).
   */
  atr14: number | null;
  bollinger: { media: number; superior: number; inferior: number; largura: number } | null;
};

export type TechnicalEntrada = {
  ticker: string;
  /** todas ordenadas do mais ANTIGO para o mais RECENTE (convenção de TA) */
  closes: number[];
  maximas: number[];
  minimas: number[];
  volumes: number[];
  /** existe tese registrada para este ticker? (para a Tese Técnica) */
  temTese: boolean;
};

export const TECHNICAL_CONFIG = {
  versaoVigente: 1,
  pesos: {
    tendencia: 0.3,
    momentum: 0.25,
    volume: 0.15,
    estrutura: 0.15,
    rompimentos: 0.15,
  } as Record<ComponenteId, number>,
} as const;
