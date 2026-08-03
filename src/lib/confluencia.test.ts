import { describe, expect, it } from "vitest";
import { calcularConfluencia } from "./confluencia";

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
