import { describe, expect, it } from "vitest";
import { calcularConfluencia, calcularConfluenciaV2, classificarConviccao, CONFLUENCIA_V2_PESOS } from "./confluencia";

describe("calcularConfluencia", () => {
  it("combina os 4 componentes quando todos estão disponíveis", () => {
    const r = calcularConfluencia({
      fundamentosScore: 80,
      fundamentosComponentes: 4,
      carryReal: 0.1,
      compounderScore: 70,
      technicalScore: 60,
    });
    expect(r.score).not.toBeNull();
    expect(r.componentesDisponiveis).toBe(4);
    expect(r.conviccao).not.toBe("indefinida");
  });

  it("renormaliza o peso quando faltam componentes (ex.: sem technical)", () => {
    const r = calcularConfluencia({
      fundamentosScore: 80,
      fundamentosComponentes: 4,
      carryReal: 0.1,
      compounderScore: 70,
      technicalScore: null,
    });
    expect(r.componentesDisponiveis).toBe(3);
    expect(r.score).not.toBeNull();
  });

  it("convicção indefinida quando quase nada está disponível", () => {
    const r = calcularConfluencia({
      fundamentosScore: null,
      fundamentosComponentes: 0,
      carryReal: null,
      compounderScore: null,
      technicalScore: 60,
    });
    expect(r.conviccao).toBe("indefinida");
  });

  it("score null quando nenhum componente está disponível", () => {
    const r = calcularConfluencia({
      fundamentosScore: null,
      fundamentosComponentes: 0,
      carryReal: null,
      compounderScore: null,
      technicalScore: null,
    });
    expect(r.score).toBeNull();
    expect(r.conviccao).toBe("indefinida");
  });
});

describe("classificarConviccao", () => {
  it("score null → sempre indefinida, mesmo com cobertura total", () => {
    expect(classificarConviccao(null, 1)).toBe("indefinida");
  });

  it("cobertura abaixo de 0.4 → indefinida mesmo com score alto", () => {
    expect(classificarConviccao(95, 0.39)).toBe("indefinida");
  });

  it("score alto (>=75) e cobertura alta (>=0.7) → alta", () => {
    expect(classificarConviccao(80, 0.8)).toBe("alta");
  });

  it("score alto mas cobertura entre 0.4 e 0.7 → moderada (não alta sem cobertura)", () => {
    expect(classificarConviccao(80, 0.5)).toBe("moderada");
  });

  it("score entre 50 e 74 (cobertura suficiente) → moderada", () => {
    expect(classificarConviccao(60, 0.9)).toBe("moderada");
  });

  it("score abaixo de 50 (cobertura suficiente) → baixa", () => {
    expect(classificarConviccao(30, 0.9)).toBe("baixa");
  });
});

describe("calcularConfluenciaV2 (Foundation v3 — Módulo 2)", () => {
  it("pesos dos 8 componentes somam 100%", () => {
    const soma = Object.values(CONFLUENCIA_V2_PESOS).reduce((a, b) => a + b, 0);
    expect(soma).toBeCloseTo(1, 10);
  });

  it("hoje só Quality, Carry e Technical têm valor — os outros 5 são pendência explícita", () => {
    const r = calcularConfluenciaV2({
      fundamentosScore: 80,
      fundamentosComponentes: 4,
      compounderScore: 70,
      carryReal: 0.1,
      technicalScore: 60,
    });
    expect(r.componentesDisponiveis).toBe(3);
    expect(r.componentesTotal).toBe(8);
    const pendentes = r.componentes.filter((c) => c.valor === null);
    expect(pendentes.map((c) => c.id).sort()).toEqual(["consensus", "growth", "macro", "management", "portfolio"]);
    for (const c of pendentes) {
      expect(c.explicacao.length).toBeGreaterThan(10);
      expect(c.explicacao.toLowerCase()).not.toMatch(/\bscore\s*\d|\bnota\s*\d|^\d/); // nunca inventa um número de resultado
    }
    expect(r.score).not.toBeNull();
  });

  it("Quality combina Fundamentos e Compounder quando ambos existem", () => {
    const r = calcularConfluenciaV2({
      fundamentosScore: 80,
      fundamentosComponentes: 4,
      compounderScore: 60,
      carryReal: null,
      technicalScore: null,
    });
    const quality = r.componentes.find((c) => c.id === "quality");
    expect(quality?.valor).toBe(70); // média de 80 e 60
    expect(quality?.explicacao).toContain("Fundamentos e Compounder");
  });

  it("Quality cai para só Compounder quando Fundamentos não tem réguas", () => {
    const r = calcularConfluenciaV2({
      fundamentosScore: null,
      fundamentosComponentes: 0,
      compounderScore: 55,
      carryReal: null,
      technicalScore: null,
    });
    const quality = r.componentes.find((c) => c.id === "quality");
    expect(quality?.valor).toBe(55);
    expect(quality?.explicacao).toContain("Compounder");
    expect(quality?.explicacao).not.toContain("Fundamentos e Compounder");
  });

  it("score null quando nada está disponível — nunca inventa", () => {
    const r = calcularConfluenciaV2({
      fundamentosScore: null,
      fundamentosComponentes: 0,
      compounderScore: null,
      carryReal: null,
      technicalScore: null,
    });
    expect(r.score).toBeNull();
    expect(r.conviccao).toBe("indefinida");
  });

  it("v1 e v2 coexistem — calcularConfluencia (v1) continua funcionando sem mudanças", () => {
    const r = calcularConfluencia({
      fundamentosScore: 80,
      fundamentosComponentes: 4,
      carryReal: 0.1,
      compounderScore: 70,
      technicalScore: 60,
    });
    expect(r.componentesDisponiveis).toBe(4);
  });
});
