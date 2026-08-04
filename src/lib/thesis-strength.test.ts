import { describe, expect, it } from "vitest";
import { calcularStrengthDelta, calcularStrengthDeltaEntreDecisions } from "./thesis-strength";
import { LIMIARES_TIMELINE } from "./decision-timeline";
import type { Decision } from "./decision-object";

describe("calcularStrengthDelta", () => {
  it("sem um dos dois snapshots: neutra, delta null, nunca inventa direção", () => {
    const r1 = calcularStrengthDelta("INTB3", null, 80);
    const r2 = calcularStrengthDelta("INTB3", 80, null);
    expect(r1.direcao).toBe("neutra");
    expect(r1.delta).toBeNull();
    expect(r2.delta).toBeNull();
  });

  it("variação abaixo do limiar da Decision Timeline: neutra, mas delta ainda é reportado", () => {
    const r = calcularStrengthDelta("INTB3", 70, 72);
    expect(r.direcao).toBe("neutra");
    expect(r.delta).toBe(2);
    expect(r.motivo).toContain(String(LIMIARES_TIMELINE.confluence));
  });

  it("subida acima do limiar: mais_forte, mesmo delta do evento de timeline", () => {
    const r = calcularStrengthDelta("INTB3", 60, 75);
    expect(r.direcao).toBe("mais_forte");
    expect(r.delta).toBe(15);
  });

  it("queda acima do limiar: mais_fraca", () => {
    const r = calcularStrengthDelta("INTB3", 75, 60);
    expect(r.direcao).toBe("mais_fraca");
    expect(r.delta).toBe(-15);
  });
});

describe("calcularStrengthDeltaEntreDecisions", () => {
  it("extrai ticker e confluence de dois Decision Objects", () => {
    const anterior = { ticker: "INTB3", confluence: 60 } as Decision;
    const atual = { ticker: "INTB3", confluence: 78 } as Decision;
    const r = calcularStrengthDeltaEntreDecisions(anterior, atual);
    expect(r.direcao).toBe("mais_forte");
    expect(r.delta).toBe(18);
  });
});
