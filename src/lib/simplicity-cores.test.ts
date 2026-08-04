import { describe, expect, it } from "vitest";
import { corDeSeveridadeFdie, corDeTendenciaNota, corDeUrgencia, CLASSE_ESTADO_COR, ROTULO_ESTADO_COR } from "./simplicity-cores";

describe("sistema de cores — 6 estados canônicos", () => {
  it("todo estado tem rótulo e classe Tailwind definidos", () => {
    for (const estado of Object.keys(ROTULO_ESTADO_COR) as (keyof typeof ROTULO_ESTADO_COR)[]) {
      expect(ROTULO_ESTADO_COR[estado].length).toBeGreaterThan(0);
      expect(CLASSE_ESTADO_COR[estado]).toContain("text-");
    }
  });
});

describe("corDeSeveridadeFdie", () => {
  it("mapeia crítico→vermelho, alerta→amarelo, ok→verde", () => {
    expect(corDeSeveridadeFdie("critico")).toBe("vermelho");
    expect(corDeSeveridadeFdie("alerta")).toBe("amarelo");
    expect(corDeSeveridadeFdie("ok")).toBe("verde");
  });
});

describe("corDeUrgencia", () => {
  it("mapeia os 4 níveis sem pular pra vermelho em urgência baixa/média", () => {
    expect(corDeUrgencia("critica")).toBe("vermelho");
    expect(corDeUrgencia("alta")).toBe("laranja");
    expect(corDeUrgencia("media")).toBe("azul");
    expect(corDeUrgencia("baixa")).toBe("cinza");
  });
});

describe("corDeTendenciaNota", () => {
  it("nunca usa vermelho para tendência — mudança de nota não é crítica por si só", () => {
    expect(corDeTendenciaNota("subindo")).not.toBe("vermelho");
    expect(corDeTendenciaNota("descendo")).not.toBe("vermelho");
    expect(corDeTendenciaNota("estavel")).not.toBe("vermelho");
  });

  it("estável fica cinza, não amarelo — oscilação normal não é atenção", () => {
    expect(corDeTendenciaNota("estavel")).toBe("cinza");
  });

  it("subindo é verde, descendo é amarelo", () => {
    expect(corDeTendenciaNota("subindo")).toBe("verde");
    expect(corDeTendenciaNota("descendo")).toBe("amarelo");
  });
});
