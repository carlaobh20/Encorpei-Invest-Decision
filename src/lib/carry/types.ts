/**
 * ENCORPEI CARRY ENGINE — tipos e contrato.
 *
 * O Carry estima a capacidade de uma empresa de aumentar patrimônio ACIMA
 * DA INFLAÇÃO, expresso como "IPCA + X% a.a.". Princípios inegociáveis:
 * - NUNCA é retorno garantido; toda exibição carrega o aviso.
 * - 100% determinístico e reproduzível (IA nenhuma no cálculo).
 * - Metodologia PLUGÁVEL: o resto do sistema depende só desta interface;
 *   trocar a fórmula = novo CarryCalculator com nova versão, nunca editar
 *   a antiga (mesma regra de versionamento do Score).
 */

export type FatorCarry = {
  /** ex.: "Retorno sobre capital alto recompõe o lucro ano após ano" */
  texto: string;
  direcao: "sustenta" | "atencao";
};

export type CarryResultado = {
  /** % real ao ano acima da inflação (0.062 = IPCA + 6,2%). null = incalculável. */
  carryReal: number | null;
  confianca: "alta" | "media" | "baixa";
  /** frase-resumo SEMPRE presente — nunca mostrar só o número */
  explicacao: string;
  fatores: FatorCarry[];
  versao: number;
  metodo: string;
};

export type CarryEntrada = {
  lucroLtm: number | null;
  marketCap: number | null;
  roic4: number | null;
  margensDesvio: number | null; // desvio-padrão das margens trimestrais
  caixaLiquido: boolean | null;
  alavancagem: number | null; // dívida líquida / patrimônio
  crescReceitaAnual: number | null; // 2025 vs 2024
  ehFinanceira: boolean; // bancos/seguradoras: roic/dívida não se aplicam
  /** dividendos+JCP pagos nos últimos 12m (DFC/CVM) — destrava o nível Growth */
  dividendosJcpLtm?: number | null;
  /** caixa operacional 12m (DFC) — destrava o nível Cash */
  caixaOperacionalLtm?: number | null;
  /** capex 12m (DFC) — destrava o nível Cash */
  capexLtm?: number | null;
};

/** Contrato do motor de cálculo — o "ativo intelectual" plugável. */
export interface CarryCalculator {
  versao: number;
  metodo: string;
  calcular(entrada: CarryEntrada): CarryResultado;
}

/**
 * Configuração versionada (nunca pesos hardcoded espalhados).
 * v2 (Growth) e v3 (Cash) já em produção, usando dividendos/payout e
 * caixa operacional/capex lidos da DFC oficial (migração 011). v4
 * (Allocation) e v5 (Retorno Intrínseco) aguardam série histórica de
 * composição de capital, não dado que falte buscar — ver docs/carry-engine.md.
 */
export const CARRY_CONFIG = {
  versaoVigente: 1,
  limiares: {
    roicAlto: 0.15,
    margemEstavel: 0.03,
    margemInstavel: 0.05,
    precoExigente: 0.05, // carry abaixo disso = preço come o retorno
    alavancagemAlta: 1.0,
    crescimentoBom: 0.05,
  },
} as const;
