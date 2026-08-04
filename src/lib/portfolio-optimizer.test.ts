import { describe, expect, it } from "vitest";
import { montarPortfolioOptimizer } from "./portfolio-optimizer";

describe("montarPortfolioOptimizer", () => {
  it("carteira já com concentração baixa e liquidez alta: nota ideal = nota atual", () => {
    const r = montarPortfolioOptimizer({
      confluenceMedio: 70,
      carryMedioPonderado: 0.1,
      concentracaoRotulo: "baixa",
      liquidezRotulo: "alta",
      qualityMedioPonderado: 60,
      portfolioFitMedioPonderado: 60,
      drawdownEsperadoMedioPonderado: -0.15,
    });
    expect(r.atual.score).toBe(r.ideal.score);
    expect(r.diferencaScore).toBe(0);
  });

  it("carteira muito concentrada e ilíquida: nota ideal > nota atual, gargalo aponta concentração/liquidez", () => {
    const r = montarPortfolioOptimizer({
      confluenceMedio: 70,
      carryMedioPonderado: 0.1,
      concentracaoRotulo: "muito_alta",
      liquidezRotulo: "baixa",
      qualityMedioPonderado: 60,
      portfolioFitMedioPonderado: 60,
      drawdownEsperadoMedioPonderado: -0.15,
    });
    expect(r.ideal.score! > r.atual.score!).toBe(true);
    expect(r.diferencaScore! > 0).toBe(true);
    const top = r.gargalos[0];
    expect(["concentracao", "liquidez"]).toContain(top.chave);
    expect(top.acionavelPorRebalanceamento).toBe(true);
  });

  it("componentes de qualidade dos ativos (confluence/carry/quality/portfolio_fit/risco) nunca mudam entre atual e ideal", () => {
    const r = montarPortfolioOptimizer({
      confluenceMedio: 50,
      carryMedioPonderado: 0.05,
      concentracaoRotulo: "alta",
      liquidezRotulo: "media",
      qualityMedioPonderado: 40,
      portfolioFitMedioPonderado: 55,
      drawdownEsperadoMedioPonderado: -0.2,
    });
    for (const chave of ["confluence", "carry", "quality", "portfolio_fit", "risco"]) {
      const g = r.gargalos.find((x) => x.chave === chave)!;
      expect(g.gap).toBe(0);
      expect(g.acionavelPorRebalanceamento).toBe(false);
    }
  });

  it("liquidez indisponível permanece indisponível no cenário ideal (nunca fabrica dado)", () => {
    const r = montarPortfolioOptimizer({
      confluenceMedio: 70,
      carryMedioPonderado: 0.1,
      concentracaoRotulo: "alta",
      liquidezRotulo: null,
      qualityMedioPonderado: 60,
      portfolioFitMedioPonderado: 60,
      drawdownEsperadoMedioPonderado: -0.15,
    });
    const gargaloLiquidez = r.gargalos.find((g) => g.chave === "liquidez")!;
    expect(gargaloLiquidez.pontosIdeal).toBeNull();
  });

  it("gargalos vêm ordenados do maior gap para o menor", () => {
    const r = montarPortfolioOptimizer({
      confluenceMedio: 70,
      carryMedioPonderado: 0.1,
      concentracaoRotulo: "muito_alta",
      liquidezRotulo: "baixa",
      qualityMedioPonderado: 60,
      portfolioFitMedioPonderado: 60,
      drawdownEsperadoMedioPonderado: -0.15,
    });
    const gaps = r.gargalos.map((g) => g.gap ?? -Infinity);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i - 1] >= gaps[i]).toBe(true);
    }
  });
});
