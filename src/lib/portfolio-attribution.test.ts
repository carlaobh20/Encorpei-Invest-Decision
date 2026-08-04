import { describe, expect, it } from "vitest";
import { montarPortfolioAttribution } from "./portfolio-attribution";

describe("montarPortfolioAttribution", () => {
  it("contribuição de retorno é peso × resultadoPct por posição", () => {
    const r = montarPortfolioAttribution([
      { ticker: "AAAA3", peso: 0.6, resultadoPct: 0.1, carryReal: 0.08 },
      { ticker: "BBBB3", peso: 0.4, resultadoPct: -0.05, carryReal: 0.05 },
    ]);
    const a = r.posicoes.find((p) => p.ticker === "AAAA3")!;
    expect(a.contribuicaoRetorno).toBeCloseTo(0.06, 6);
    const b = r.posicoes.find((p) => p.ticker === "BBBB3")!;
    expect(b.contribuicaoRetorno).toBeCloseTo(-0.02, 6);
  });

  it("contribuição de carry é peso × carryReal", () => {
    const r = montarPortfolioAttribution([{ ticker: "AAAA3", peso: 0.5, resultadoPct: 0, carryReal: 0.1 }]);
    expect(r.posicoes[0].contribuicaoCarry).toBeCloseTo(0.05, 6);
  });

  it("dado null em resultadoPct/carryReal vira contribuição null, nunca 0 decorativo", () => {
    const r = montarPortfolioAttribution([{ ticker: "AAAA3", peso: 0.5, resultadoPct: null, carryReal: null }]);
    expect(r.posicoes[0].contribuicaoRetorno).toBeNull();
    expect(r.posicoes[0].contribuicaoCarry).toBeNull();
  });

  it("posição claramente dominante (0.7 contra 3× 0.1) tem impactoConcentracao positivo — removê-la diversifica o resto", () => {
    const r = montarPortfolioAttribution([
      { ticker: "GRANDE3", peso: 0.7, resultadoPct: 0, carryReal: null },
      { ticker: "B3", peso: 0.1, resultadoPct: 0, carryReal: null },
      { ticker: "C3", peso: 0.1, resultadoPct: 0, carryReal: null },
      { ticker: "D3", peso: 0.1, resultadoPct: 0, carryReal: null },
    ]);
    const grande = r.posicoes.find((p) => p.ticker === "GRANDE3")!;
    expect(grande.impactoConcentracao).toBeGreaterThan(0);
  });

  it("carteira de só 2 posições — remover qualquer uma deixa 100% na outra, sempre mais concentrado (impacto negativo)", () => {
    const r = montarPortfolioAttribution([
      { ticker: "A3", peso: 0.5, resultadoPct: 0, carryReal: null },
      { ticker: "B3", peso: 0.5, resultadoPct: 0, carryReal: null },
    ]);
    expect(r.posicoes[0].impactoConcentracao).toBeLessThan(0);
    expect(r.posicoes[1].impactoConcentracao).toBeLessThan(0);
  });

  it("aviso de volatilidade está sempre presente e nunca fica vazio", () => {
    const r = montarPortfolioAttribution([{ ticker: "A3", peso: 1, resultadoPct: 0, carryReal: null }]);
    expect(r.avisoVolatilidade.length).toBeGreaterThan(0);
  });

  it("carteira vazia não quebra, devolve lista vazia", () => {
    const r = montarPortfolioAttribution([]);
    expect(r.posicoes).toEqual([]);
  });

  it("expansão de múltiplo e dividendos aparecem sempre como fatores indisponíveis, com motivo — nunca fabricados (Sprint 2.9)", () => {
    const r = montarPortfolioAttribution([{ ticker: "A3", peso: 1, resultadoPct: 0, carryReal: null }]);
    expect(r.fatoresIndisponiveis.map((f) => f.chave).sort()).toEqual(["dividendos", "expansao_multiplo"]);
    for (const f of r.fatoresIndisponiveis) {
      expect(f.motivo.length).toBeGreaterThan(0);
    }
  });
});
