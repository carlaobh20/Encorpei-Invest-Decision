import type { ConcentracaoRotulo } from "./portfolio-health";

/**
 * APRENDIZADOS DA CARTEIRA (Bloco 2, Sprint 2.8, Wealth Operating System —
 * Seção 8, Wealth Coach).
 *
 * "Sempre baseado em fatos. Nunca inventar." — compara a Saúde da Carteira
 * ANTES e DEPOIS da posição mais recente (por `data_compra`, migração 016,
 * já aplicada), reaproveitando os mesmos campos de `SaudeCarteira`
 * (portfolio-health.ts) já calculados para as 2 versões da carteira. Uma
 * frase só aparece quando um limiar real é cruzado (banda de concentração
 * muda, Carry sobe um tanto relevante, Quality Score sobe, um setor perde
 * peso) — nenhuma frase "estável" ou genérica de preenchimento.
 *
 * Os 4 exemplos literais da spec (diversificação/exposição setorial/
 * proteção contra inflação/qualidade) mapeiam 1:1 pros 4 checks abaixo.
 */

export type LicaoCarteira = { texto: string };

export type SaudeComparavel = {
  concentracaoRotulo: ConcentracaoRotulo;
  carryMedioPonderado: number | null;
  qualityMedioPonderado: number | null;
  alocacaoPorModelo: { rotulo: string; pct: number }[];
};

const ORDEM_CONCENTRACAO: Record<ConcentracaoRotulo, number> = { baixa: 0, moderada: 1, alta: 2, muito_alta: 3 };
const LIMIAR_CARRY_PP = 0.005; // 0,5pp
const LIMIAR_QUALITY_PONTOS = 3;
const LIMIAR_SETOR_PP = 0.03; // 3pp de peso

export function gerarAprendizadosCarteira(antes: SaudeComparavel, depois: SaudeComparavel, tickerEntrada: string): LicaoCarteira[] {
  const licoes: LicaoCarteira[] = [];

  const ordemAntes = ORDEM_CONCENTRACAO[antes.concentracaoRotulo];
  const ordemDepois = ORDEM_CONCENTRACAO[depois.concentracaoRotulo];
  if (ordemDepois < ordemAntes) {
    licoes.push({ texto: `Sua diversificação aumentou desde a entrada de ${tickerEntrada} — concentração caiu de ${antes.concentracaoRotulo.replace("_", " ")} para ${depois.concentracaoRotulo.replace("_", " ")}.` });
  } else if (ordemDepois > ordemAntes) {
    licoes.push({ texto: `Sua diversificação piorou desde a entrada de ${tickerEntrada} — concentração subiu de ${antes.concentracaoRotulo.replace("_", " ")} para ${depois.concentracaoRotulo.replace("_", " ")}.` });
  }

  if (antes.carryMedioPonderado !== null && depois.carryMedioPonderado !== null) {
    const delta = depois.carryMedioPonderado - antes.carryMedioPonderado;
    if (delta >= LIMIAR_CARRY_PP) {
      licoes.push({ texto: `Sua proteção contra inflação melhorou desde a entrada de ${tickerEntrada} — Carry médio subiu ${(delta * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}pp.` });
    } else if (delta <= -LIMIAR_CARRY_PP) {
      licoes.push({ texto: `Sua proteção contra inflação caiu desde a entrada de ${tickerEntrada} — Carry médio recuou ${(Math.abs(delta) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}pp.` });
    }
  }

  if (antes.qualityMedioPonderado !== null && depois.qualityMedioPonderado !== null) {
    const delta = depois.qualityMedioPonderado - antes.qualityMedioPonderado;
    if (delta >= LIMIAR_QUALITY_PONTOS) {
      licoes.push({ texto: `Sua qualidade média aumentou desde a entrada de ${tickerEntrada} — Quality Score subiu ${Math.round(delta)} pontos.` });
    } else if (delta <= -LIMIAR_QUALITY_PONTOS) {
      licoes.push({ texto: `Sua qualidade média caiu desde a entrada de ${tickerEntrada} — Quality Score recuou ${Math.round(Math.abs(delta))} pontos.` });
    }
  }

  const antesPorSetor = new Map(antes.alocacaoPorModelo.map((s) => [s.rotulo, s.pct]));
  for (const setorDepois of depois.alocacaoPorModelo) {
    const pctAntes = antesPorSetor.get(setorDepois.rotulo) ?? 0;
    const delta = setorDepois.pct - pctAntes;
    if (delta <= -LIMIAR_SETOR_PP) {
      licoes.push({ texto: `Sua exposição ao setor ${setorDepois.rotulo} caiu ${(Math.abs(delta) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}pp desde a entrada de ${tickerEntrada}.` });
    }
  }

  return licoes;
}
