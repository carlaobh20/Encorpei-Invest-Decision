import { describe, expect, it } from "vitest";
import { montarWealthHealth, ROTULO_BANDA_WEALTH_HEALTH, type EntradaWealthHealth } from "./wealth-health";

const CHEIA: EntradaWealthHealth = {
  confluenceMedio: 80,
  carryMedioPonderado: 0.15,
  concentracaoRotulo: "baixa",
  liquidezRotulo: "alta",
  qualityMedioPonderado: 80,
  portfolioFitMedioPonderado: 80,
  drawdownEsperadoMedioPonderado: 0,
};

describe("montarWealthHealth", () => {
  it("com todos os componentes fortes disponíveis, score alto e banda excelente", () => {
    const r = montarWealthHealth(CHEIA);
    expect(r.score).not.toBeNull();
    expect(r.score as number).toBeGreaterThanOrEqual(85);
    expect(r.banda).toBe("excelente");
    expect(r.coberturaComponentes).toBe(7);
  });

  it("sem nenhum dado disponível (exceto concentração, sempre disponível), ainda calcula com o que tem", () => {
    const r = montarWealthHealth({
      confluenceMedio: null,
      carryMedioPonderado: null,
      concentracaoRotulo: "muito_alta",
      liquidezRotulo: null,
      qualityMedioPonderado: null,
      portfolioFitMedioPonderado: null,
      drawdownEsperadoMedioPonderado: null,
    });
    expect(r.coberturaComponentes).toBe(1);
    expect(r.score).toBe(10); // só concentração muito_alta = 10 pontos, sozinha carrega 100% do peso disponível
  });

  it("concentração sempre disponível — nunca fica null mesmo sem nenhum outro dado", () => {
    const r = montarWealthHealth({ ...CHEIA, confluenceMedio: null, carryMedioPonderado: null, liquidezRotulo: null, qualityMedioPonderado: null, portfolioFitMedioPonderado: null, drawdownEsperadoMedioPonderado: null });
    const concentracao = r.componentes.find((c) => c.chave === "concentracao");
    expect(concentracao?.disponivel).toBe(true);
    expect(concentracao?.pontos).toBe(100);
  });

  it("carry acima do teto editorial (15%) satura em 100 pontos, nunca passa de 100", () => {
    const r = montarWealthHealth({ ...CHEIA, carryMedioPonderado: 0.5 });
    const carry = r.componentes.find((c) => c.chave === "carry");
    expect(carry?.pontos).toBe(100);
  });

  it("drawdown esperado pior que o piso editorial (-40%) satura em 0 pontos, nunca negativo", () => {
    const r = montarWealthHealth({ ...CHEIA, drawdownEsperadoMedioPonderado: -0.9 });
    const risco = r.componentes.find((c) => c.chave === "risco");
    expect(risco?.pontos).toBe(0);
  });

  it("tabela de bandas tem as 6 faixas + indisponível, cada uma com rótulo", () => {
    expect(Object.keys(ROTULO_BANDA_WEALTH_HEALTH)).toHaveLength(7);
    for (const rotulo of Object.values(ROTULO_BANDA_WEALTH_HEALTH)) expect(rotulo.length).toBeGreaterThan(0);
  });

  it("nunca mostra a nota sozinha sem rótulo — banda sempre presente junto do score", () => {
    const r = montarWealthHealth(CHEIA);
    expect(ROTULO_BANDA_WEALTH_HEALTH[r.banda]).toBeTruthy();
  });
});
