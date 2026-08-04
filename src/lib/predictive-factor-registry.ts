/**
 * PREDICTIVE FACTOR REGISTRY (Foundation v4 — Módulo 12).
 *
 * Catálogo de todo fator preditivo que o sistema produz hoje: descrição,
 * objetivo, origem (arquivo/motor), limitações, hipóteses associadas
 * (quando existir uma linha correspondente em `erl.hipoteses`) e evidências
 * relacionadas. DECISÃO ARQUITETURAL EXPLÍCITA: registry ESTÁTICO em
 * código, não uma tabela nova no banco — os fatores hoje são um conjunto
 * fixo, definido no código de cada motor (Confluence, Carry, Probability,
 * Portfolio Fit etc.), não algo que usuários criam em runtime. Uma tabela
 * seria infraestrutura sem necessidade comprovada (mesmo raciocínio já
 * usado para não criar `erl.feature_store` antes da hora — ver migração
 * 019). Se um dia fatores passarem a ser definidos dinamicamente, este
 * registry migra para tabela; até lá, código é mais simples e já
 * type-checked pelo compilador.
 *
 * `status`: "ativo" (tem motor real calculando hoje), "experimental" (tem
 * código mas sem dado real por trás — sempre null com pendência, ver o
 * motor de origem) ou "descartado" (existiu e foi removido/substituído —
 * mantido aqui só como registro histórico, nunca deletado, mesmo espírito
 * de `erl.hipoteses.status`).
 */

import { MIN_PREGOES_CORRELACAO } from "./portfolio-fit";

export type StatusFator = "ativo" | "experimental" | "descartado";

export type FatorPreditivo = {
  id: string;
  nome: string;
  descricao: string;
  objetivo: string;
  origem: string; // arquivo/motor onde o fator é calculado
  limitacoes: string;
  /** ids de erl.hipoteses relacionadas, quando existirem — vazio é normal, não é pendência */
  hipoteses: number[];
  /** categorias de evidence.ts que alimentam ou explicam este fator, quando aplicável */
  evidenciasRelacionadas: string[];
  status: StatusFator;
};

export const REGISTRO_FATORES_PREDITIVOS: FatorPreditivo[] = [
  {
    id: "confluence_quality",
    nome: "Confluence — Quality",
    descricao: "Média de Fundamentos e Compounder — qualidade do negócio.",
    objetivo: "Medir solidez fundamentalista e de modelo de negócio, independente de preço.",
    origem: "confluencia.ts (calcularConfluenciaV2)",
    limitacoes: "Depende de dados de DFP/ITR da CVM já processados; empresas com demonstrativo zerado/incompleto ficam com nota parcial.",
    hipoteses: [],
    evidenciasRelacionadas: ["margem", "roic", "receita"],
    status: "ativo",
  },
  {
    id: "confluence_carry",
    nome: "Confluence — Carry",
    descricao: "Nota derivada do Carry Engine (escada de 5 níveis, melhor degrau calculável).",
    objetivo: "Medir retorno sobre o preço pago hoje, com corte honesto quando o dado não sustenta o nível mais avançado da escada.",
    origem: "confluencia.ts + carry/escada.ts",
    limitacoes: "Só o Floor (nível 1) é sempre calculável; o Retorno Intrínseco (nível 5) hoje é sempre null — ver carry/escada.ts.",
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "ativo",
  },
  {
    id: "confluence_technical",
    nome: "Confluence — Technical",
    descricao: "Nota técnica sobre a série de preço (faixas via mapaFaixas).",
    objetivo: "Capturar contexto de preço/momentum, complementar aos fatores fundamentalistas.",
    origem: "confluencia.ts",
    limitacoes: "Não incorpora volume nem padrões gráficos — só as faixas hoje calibradas no código.",
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "ativo",
  },
  {
    id: "confluence_growth",
    nome: "Confluence — Growth",
    descricao: "Componente reservado para crescimento projetado.",
    objetivo: "Complementar Quality com uma leitura prospectiva de crescimento.",
    origem: "confluencia.ts (CONFLUENCIA_V2_PESOS.growth)",
    limitacoes: "Sem coletor de dado real hoje — sempre null com pendência explícita no Confluence v2.",
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "experimental",
  },
  {
    id: "confluence_macro",
    nome: "Confluence — Macro",
    descricao: "Componente reservado para contexto macroeconômico (Selic/IPCA/Focus).",
    objetivo: "Ajustar a nota pela conjuntura macro vigente.",
    origem: "confluencia.ts (CONFLUENCIA_V2_PESOS.macro); dado bruto existe em Macro Engine v0 (macro_focus)",
    limitacoes: "Macro Engine v0 coleta Focus semanal mas ainda não alimenta este componente do Confluence — pendência de fiação, não de dado.",
    hipoteses: [],
    evidenciasRelacionadas: ["macro_focus", "macro_selic"],
    status: "experimental",
  },
  {
    id: "confluence_consensus",
    nome: "Confluence — Consensus",
    descricao: "Componente reservado para consenso de mercado/analistas.",
    objetivo: "Contrastar a nota interna com a visão do mercado.",
    origem: "confluencia.ts (CONFLUENCIA_V2_PESOS.consensus)",
    limitacoes: "Sem fonte de consenso de analistas integrada — ver erl.cobertura_dados ('consenso_analistas': indisponível).",
    hipoteses: [],
    evidenciasRelacionadas: ["consenso"],
    status: "experimental",
  },
  {
    id: "confluence_management",
    nome: "Confluence — Management",
    descricao: "Componente reservado para qualidade de gestão/governança.",
    objetivo: "Capturar sinais de gestão (fatos relevantes, movimentação de insiders/controladores).",
    origem: "confluencia.ts (CONFLUENCIA_V2_PESOS.management); dado bruto parcial via Management Intelligence v0 (IPE/CVM)",
    limitacoes: "Management Intelligence v0 coleta fatos relevantes mas não alimenta este componente ainda — pendência de fiação.",
    hipoteses: [],
    evidenciasRelacionadas: ["insider_compra", "insider_venda", "controlador_venda", "regulatorio"],
    status: "experimental",
  },
  {
    id: "confluence_portfolio",
    nome: "Confluence — Portfolio",
    descricao: "Componente reservado para encaixe na carteira dentro do próprio Confluence.",
    objetivo: "Pontuar diversificação/concentração como parte da nota consolidada.",
    origem: "confluencia.ts (CONFLUENCIA_V2_PESOS.portfolio); motor equivalente real existe separado em portfolio-fit.ts",
    limitacoes: "Portfolio Fit Engine (Foundation v4) já calcula isso como motor independente — nunca foi religado como componente do Confluence, decisão deliberada para não duplicar a mesma nota em dois lugares.",
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "experimental",
  },
  {
    id: "probability_v1",
    nome: "Probability Engine v1",
    descricao: "Julga decisões já tomadas pelo investidor comparando preço na decisão vs. preço atual.",
    objetivo: "Medir, historicamente, se as decisões do próprio Carlos foram a favor ou contra o preço.",
    origem: "probability-engine.ts",
    limitacoes: "Só julga direção de preço, não qualidade da tese; decisões com menos de 30 dias ficam marcadas não confiáveis.",
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "ativo",
  },
  {
    id: "probability_v2_horizonte",
    nome: "Probability Engine v2 (por horizonte)",
    descricao: "Retorno esperado/drawdown esperado por horizonte de tempo, com backtest vs. CDI/Ibovespa.",
    objetivo: "Estimar distribuição de retorno futuro a partir de janelas históricas reais.",
    origem: "probability-engine-v2.ts",
    limitacoes: "Horizontes maiores (ex.: 12 meses) só destravam com anos suficientes de histórico de preço — ficam null+motivo até lá.",
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "ativo",
  },
  {
    id: "sensibilidade_juros",
    nome: "Sensibilidade à Selic (Compounder)",
    descricao: "Heurística de exposição de uma empresa a movimentos da Selic (alavancagem + retenção + modelo de negócio).",
    objetivo: "Apoiar leitura de cenário sem depender só do setor.",
    origem: "compounder/sensibilidade-juros.ts",
    limitacoes: "Heurística declarada, nunca calibrada contra o histórico real de preço vs. movimentos da Selic — documentado na própria tela onde aparece.",
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "experimental",
  },
  {
    id: "portfolio_fit_concentracao",
    nome: "Portfolio Fit — Concentração",
    descricao: "Penaliza posições que ultrapassariam o teto de concentração por ativo/setor.",
    objetivo: "Evitar concentração excessiva medida objetivamente, não por intuição.",
    origem: "portfolio-fit.ts",
    limitacoes: "Teto (LIMIAR_CONCENTRACAO_ATIVO/SETOR) é um parâmetro fixo no código, não calibrado por perfil de risco do usuário ainda.",
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "ativo",
  },
  {
    id: "portfolio_fit_correlacao",
    nome: "Portfolio Fit — Correlação",
    descricao: "Correlação de Pearson entre a candidata e posições existentes, sobre retornos diários.",
    objetivo: "Medir diversificação real de comportamento de preço, não só de setor.",
    origem: "portfolio-fit.ts (correlacaoPearson)",
    limitacoes: `Exige pelo menos ${MIN_PREGOES_CORRELACAO} pregões de histórico comum — abaixo disso, fica null com motivo.`,
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "ativo",
  },
  {
    id: "evidence_weight",
    nome: "Evidence Weight",
    descricao: "Peso por categoria de evidência, só alterável por aprovação manual registrada em erl.aprovacoes.",
    objetivo: "Deixar o Research Lab propor ajuste de peso sem nunca automatizar a mudança.",
    origem: "evidence-weight.ts",
    limitacoes: "Peso fica sempre no padrão neutro (1) até existir pelo menos uma aprovação manual válida (aprovado=true + aprovado_por preenchido) para a categoria.",
    hipoteses: [],
    evidenciasRelacionadas: ["margem", "roic", "receita", "custos", "guidance", "regulatorio", "macro_focus", "macro_selic", "fluxo", "consenso"],
    status: "experimental",
  },
  {
    id: "thesis_strength_delta",
    nome: "Thesis Strength Delta",
    descricao: "Direção (mais forte/mais fraca/neutra) da tese entre duas leituras de Confluence.",
    objetivo: "Nunca reportar só um score — sempre a variação e a direção também.",
    origem: "thesis-strength.ts (reaproveita detectarMudancaConfluence de decision-timeline.ts)",
    limitacoes: "Sensível ao mesmo limiar de `detectarMudancaConfluence` — mudanças pequenas demais ficam classificadas como neutras.",
    hipoteses: [],
    evidenciasRelacionadas: [],
    status: "ativo",
  },
];

export function buscarFator(id: string): FatorPreditivo | null {
  return REGISTRO_FATORES_PREDITIVOS.find((f) => f.id === id) ?? null;
}

export function listarFatoresPorStatus(status: StatusFator): FatorPreditivo[] {
  return REGISTRO_FATORES_PREDITIVOS.filter((f) => f.status === status);
}

export function contarFatoresPorStatus(): Record<StatusFator, number> {
  const contagem: Record<StatusFator, number> = { ativo: 0, experimental: 0, descartado: 0 };
  for (const f of REGISTRO_FATORES_PREDITIVOS) contagem[f.status]++;
  return contagem;
}

/**
 * Auditoria do próprio registro: fatores sem `limitacoes` documentada (texto
 * vazio) — o registry só cumpre seu propósito se toda entrada disser
 * honestamente onde o fator falha, então isso nunca deveria retornar
 * itens em código já revisado; existe como guarda-corrimão pra próximo
 * fator adicionado sem essa disciplina.
 */
export function fatoresSemLimitacoesDocumentadas(): FatorPreditivo[] {
  return REGISTRO_FATORES_PREDITIVOS.filter((f) => f.limitacoes.trim().length === 0);
}
