import { describe, expect, it } from "vitest";
import { calcularScorePorModelo, ptsRoe } from "./score-setorial";

/** Fase B do Sector Intelligence — as réguas certas para cada modelo. */

const entradaBanco = {
  roic: null,
  roe: 0.21, // Itaú-like
  margem_liquida: 0.28,
  divida_liquida: null,
  patrimonio_liquido: 180_000_000_000,
  lucro_ltm: 38_000_000_000,
  market_cap: 390_000_000_000, // ey ~9,7%
  margens_trimestrais: [0.27, 0.28, 0.28, 0.29],
};

describe("score setorial v2 — financeiras", () => {
  it("banco: qualidade por ROE, SEM componente de dívida/ROIC industrial", () => {
    const r = calcularScorePorModelo("ITUB4", entradaBanco);
    expect(r.versao).toBe(2);
    expect(r.modelo).toBe("banco");
    const regras = r.decomposicao.map((d) => d.regra).join(" | ");
    expect(regras).toContain("ROE");
    expect(regras).not.toMatch(/dívida|ROIC/i);
    expect(r.confianca).toBe("alta"); // 3 componentes possíveis p/ banco
    expect(r.score_final).toBeGreaterThan(70);
  });

  it("ROE 20%+ é teto; 8% é piso da banda intermediária", () => {
    expect(ptsRoe(0.2)).toBe(100);
    expect(ptsRoe(0.08)).toBeCloseTo(40, 5);
    expect(ptsRoe(0.14)).toBeCloseTo(70, 5);
  });

  it("seguradora também usa réguas de financeira", () => {
    const r = calcularScorePorModelo("PSSA3", entradaBanco);
    expect(r.modelo).toBe("seguradora");
    expect(r.decomposicao.map((d) => d.regra).join()).toContain("ROE");
  });
});

describe("score setorial v2 — demais modelos", () => {
  it("industrial: idêntico à v1 (compatibilidade total)", () => {
    const e = {
      roic: 0.25, roe: 0.3, margem_liquida: 0.16,
      divida_liquida: -1_000, patrimonio_liquido: 10_000,
      lucro_ltm: 100, market_cap: 1_000,
      margens_trimestrais: [0.15, 0.16, 0.16],
    };
    const r = calcularScorePorModelo("WEGE3", e);
    expect(r.modelo).toBe("industrial");
    // v1 não usa ROE em industriais
    expect(r.decomposicao.map((d) => d.regra).join()).not.toContain("ROE");
    expect(r.decomposicao.map((d) => d.regra).join()).toContain("ROIC");
  });

  it("commodities carrega o aviso de ciclo na decomposição", () => {
    const e = {
      roic: 0.18, roe: null, margem_liquida: 0.22,
      divida_liquida: 5_000, patrimonio_liquido: 100_000,
      lucro_ltm: 40_000, market_cap: 300_000,
      margens_trimestrais: [0.2, 0.22, 0.25],
    };
    const r = calcularScorePorModelo("VALE3", e);
    expect(r.modelo).toBe("commodities");
    expect(r.decomposicao.some((d) => d.regra.includes("ciclo"))).toBe(true);
  });
});
