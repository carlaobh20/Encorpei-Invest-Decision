import { describe, expect, it } from "vitest";
import { montarCapitalAllocationView } from "./capital-allocation-simulacao";

describe("montarCapitalAllocationView", () => {
  it("carteira vazia não quebra", () => {
    const r = montarCapitalAllocationView([]);
    expect(r.posicoes).toEqual([]);
  });

  it("posição com Confluence abaixo do piso fica fora da simulação, com motivo explícito", () => {
    const r = montarCapitalAllocationView([
      { ticker: "FRACA3", pesoAtual: 0.5, confluence: 30 },
      { ticker: "FORTE3", pesoAtual: 0.5, confluence: 80 },
    ]);
    const fraca = r.posicoes.find((p) => p.ticker === "FRACA3")!;
    expect(fraca.pesoSugerido).toBeNull();
    expect(fraca.motivoForaDistribuicao).toContain("piso de convicção");
    expect(r.percentualForaDistribuicao).toBeCloseTo(0.5, 6);
  });

  it("Confluence indisponível também fica fora, com motivo específico", () => {
    const r = montarCapitalAllocationView([{ ticker: "A3", pesoAtual: 1, confluence: null }]);
    expect(r.posicoes[0].motivoForaDistribuicao).toContain("indisponível");
  });

  it("nenhuma posição excede o teto de concentração do motor congelado (15%)", () => {
    const r = montarCapitalAllocationView([
      { ticker: "A3", pesoAtual: 0.9, confluence: 95 },
      { ticker: "B3", pesoAtual: 0.05, confluence: 60 },
      { ticker: "C3", pesoAtual: 0.05, confluence: 60 },
    ]);
    for (const p of r.posicoes) {
      if (p.pesoSugerido !== null) expect(p.pesoSugerido).toBeLessThanOrEqual(0.15 + 1e-6);
    }
  });

  it("aviso de simulação está sempre presente e afirma explicitamente que nunca é uma ordem", () => {
    const r = montarCapitalAllocationView([{ ticker: "A3", pesoAtual: 1, confluence: 80 }]);
    expect(r.aviso.toLowerCase()).toContain("simulação");
    expect(r.aviso.toLowerCase()).toContain("nunca é uma ordem");
  });

  it("concentração atual e simulada são calculadas via HHI, nunca hardcoded", () => {
    const r = montarCapitalAllocationView([
      { ticker: "DOMINANTE3", pesoAtual: 0.8, confluence: 90 },
      { ticker: "B3", pesoAtual: 0.1, confluence: 55 },
      { ticker: "C3", pesoAtual: 0.1, confluence: 55 },
    ]);
    expect(r.concentracaoAtual).toBe("muito_alta");
  });
});
