import type { ConcentracaoRotulo } from "./portfolio-health";

/**
 * WEALTH HEALTH (Bloco 2, Sprint 2.8, Wealth Operating System — Seção 1).
 *
 * "A nota deverá considerar apenas motores já existentes. Nunca criar
 * cálculo novo." Lido ao pé da letra: cada COMPONENTE vem de um motor que
 * já existe (Confluence v2, Carry, `SaudeCarteiraV2` — concentração/
 * liquidez, Decision.quality, Portfolio Fit, Decision.expectedDrawdown).
 * O que É novo aqui é a COMPOSIÇÃO — combinar esses números já calculados
 * num único 0-100, mesma categoria de trabalho que `calcularSaudeCarteira`
 * (portfolio-health.ts) e `calcularDataQualityScore` (Truth Layer, Sprint
 * 2.4) já fazem: camada de produto sobre motores, não motor novo.
 *
 * Onde um motor real não existe (Decision.risk.nivel é sempre `null` hoje
 * — "sem motor de risco dedicado", ver decision-object.ts), o componente
 * de Risco usa o proxy que o PRÓPRIO código já sugere: `expectedDrawdown`
 * (Probability V2). Nunca inventa um número de risco.
 *
 * Pesos e bandas de conversão (Carry→pontos, rótulo de concentração→
 * pontos, rótulo de liquidez→pontos, drawdown→pontos) são heurística
 * EDITORIAL — mesmo tipo de corte já registrado como tal em
 * `erros-classicos.ts`/`decisoes-prioritarias.ts`. Documentado aqui, não
 * escondido, e o Carlos deveria ratificar os pesos (ver ENTREGA do Sprint
 * 2.8 / roadmap).
 *
 * Componente sem dado disponível NUNCA vira 0 — é excluído e o peso dos
 * demais é renormalizado (mesmo padrão de `mediaPonderada`,
 * portfolio-health.ts) — "cobertura honesta", não penalização silenciosa.
 */

export type BandaWealthHealth = "excelente" | "muito_boa" | "boa" | "regular" | "fraca" | "muito_fraca" | "indisponivel";

export const ROTULO_BANDA_WEALTH_HEALTH: Record<BandaWealthHealth, string> = {
  excelente: "Excelente",
  muito_boa: "Muito Boa",
  boa: "Boa",
  regular: "Regular",
  fraca: "Fraca",
  muito_fraca: "Muito Fraca",
  indisponivel: "Sem dado suficiente",
};

export type ComponenteWealthHealth = {
  chave: string;
  rotulo: string;
  pontos: number | null;
  peso: number;
  disponivel: boolean;
};

export type WealthHealth = {
  score: number | null;
  banda: BandaWealthHealth;
  componentes: ComponenteWealthHealth[];
  coberturaComponentes: number;
  totalComponentes: number;
};

export type EntradaWealthHealth = {
  confluenceMedio: number | null;
  carryMedioPonderado: number | null;
  concentracaoRotulo: ConcentracaoRotulo;
  liquidezRotulo: "alta" | "media" | "baixa" | null;
  qualityMedioPonderado: number | null;
  portfolioFitMedioPonderado: number | null;
  drawdownEsperadoMedioPonderado: number | null;
};

const PESO: Record<string, number> = {
  confluence: 25,
  carry: 15,
  concentracao: 15,
  liquidez: 10,
  quality: 15,
  portfolio_fit: 10,
  risco: 10,
};

/** Editorial: IPCA+0% → 0pts, IPCA+15%+ → 100pts. */
const CARRY_TETO = 0.15;
function pontosCarry(carry: number): number {
  return Math.max(0, Math.min(100, (carry / CARRY_TETO) * 100));
}

const PONTOS_CONCENTRACAO: Record<ConcentracaoRotulo, number> = {
  baixa: 100,
  moderada: 70,
  alta: 40,
  muito_alta: 10,
};

const PONTOS_LIQUIDEZ: Record<"alta" | "media" | "baixa", number> = {
  alta: 100,
  media: 60,
  baixa: 20,
};

/** Editorial: 0% de drawdown esperado → 100pts, -40% ou pior → 0pts. */
const DRAWDOWN_PISO = 0.4;
function pontosRisco(drawdown: number): number {
  return Math.max(0, Math.min(100, 100 - (Math.abs(drawdown) / DRAWDOWN_PISO) * 100));
}

function banda(score: number): BandaWealthHealth {
  if (score >= 85) return "excelente";
  if (score >= 70) return "muito_boa";
  if (score >= 55) return "boa";
  if (score >= 40) return "regular";
  if (score >= 25) return "fraca";
  return "muito_fraca";
}

export function montarWealthHealth(entrada: EntradaWealthHealth): WealthHealth {
  const componentes: ComponenteWealthHealth[] = [
    { chave: "confluence", rotulo: "Confluence médio", pontos: entrada.confluenceMedio, peso: PESO.confluence, disponivel: entrada.confluenceMedio !== null },
    { chave: "carry", rotulo: "Carry", pontos: entrada.carryMedioPonderado !== null ? pontosCarry(entrada.carryMedioPonderado) : null, peso: PESO.carry, disponivel: entrada.carryMedioPonderado !== null },
    { chave: "concentracao", rotulo: "Diversificação", pontos: PONTOS_CONCENTRACAO[entrada.concentracaoRotulo], peso: PESO.concentracao, disponivel: true },
    { chave: "liquidez", rotulo: "Liquidez", pontos: entrada.liquidezRotulo !== null ? PONTOS_LIQUIDEZ[entrada.liquidezRotulo] : null, peso: PESO.liquidez, disponivel: entrada.liquidezRotulo !== null },
    { chave: "quality", rotulo: "Quality Score", pontos: entrada.qualityMedioPonderado, peso: PESO.quality, disponivel: entrada.qualityMedioPonderado !== null },
    { chave: "portfolio_fit", rotulo: "Portfolio Fit", pontos: entrada.portfolioFitMedioPonderado, peso: PESO.portfolio_fit, disponivel: entrada.portfolioFitMedioPonderado !== null },
    { chave: "risco", rotulo: "Risco (drawdown esperado)", pontos: entrada.drawdownEsperadoMedioPonderado !== null ? pontosRisco(entrada.drawdownEsperadoMedioPonderado) : null, peso: PESO.risco, disponivel: entrada.drawdownEsperadoMedioPonderado !== null },
  ];

  const disponiveis = componentes.filter((c) => c.disponivel && c.pontos !== null);
  const pesoTotal = disponiveis.reduce((a, c) => a + c.peso, 0);

  if (disponiveis.length === 0 || pesoTotal === 0) {
    return { score: null, banda: "indisponivel", componentes, coberturaComponentes: 0, totalComponentes: componentes.length };
  }

  const soma = disponiveis.reduce((a, c) => a + (c.pontos as number) * c.peso, 0);
  const score = Math.round(soma / pesoTotal);

  return { score, banda: banda(score), componentes, coberturaComponentes: disponiveis.length, totalComponentes: componentes.length };
}
