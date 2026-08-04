import { describe, expect, it } from "vitest";
import { estimativaDeAmostra, estimativaIndisponivel, percentil } from "./estimativa";

describe("percentil", () => {
  it("amostra vazia: null", () => {
    expect(percentil([], 0.5)).toBeNull();
  });

  it("mediana de [1,2,3,4,5] é 3", () => {
    expect(percentil([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("p0 é o mínimo, p1 é o máximo", () => {
    const a = [5, 1, 3, 2, 4];
    expect(percentil(a, 0)).toBe(1);
    expect(percentil(a, 1)).toBe(5);
  });

  it("interpola entre pontos quando a posição não é inteira", () => {
    expect(percentil([1, 2], 0.5)).toBeCloseTo(1.5, 10);
  });
});

describe("estimativaIndisponivel", () => {
  it("tudo null exceto o motivo — nunca inventa número", () => {
    const e = estimativaIndisponivel("sem dado");
    expect(e.valor).toBeNull();
    expect(e.intervaloInferior).toBeNull();
    expect(e.intervaloSuperior).toBeNull();
    expect(e.nivelConfianca).toBeNull();
    expect(e.motivo).toBe("sem dado");
  });
});

describe("estimativaDeAmostra", () => {
  it("amostra vazia: cai no indisponível", () => {
    const e = estimativaDeAmostra([]);
    expect(e.valor).toBeNull();
    expect(e.motivo).not.toBeNull();
  });

  it("valor é a média; intervalo cobre o nível de confiança pedido", () => {
    const amostra = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0];
    const e = estimativaDeAmostra(amostra, 0.8);
    expect(e.valor).toBeCloseTo(0.55, 10);
    expect(e.nivelConfianca).toBe(0.8);
    expect(e.intervaloInferior).not.toBeNull();
    expect(e.intervaloSuperior).not.toBeNull();
    expect(e.intervaloInferior!).toBeLessThan(e.valor!);
    expect(e.intervaloSuperior!).toBeGreaterThan(e.valor!);
    expect(e.motivo).toBeNull();
  });
});
