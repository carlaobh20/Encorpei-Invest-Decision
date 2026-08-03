import { describe, expect, it } from "vitest";
import { calcularConfluencia, classificarConviccao } from "./confluencia";

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
