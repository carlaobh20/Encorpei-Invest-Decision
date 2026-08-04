import { describe, expect, it } from "vitest";
import { emitirEvidenciasCarry, type CarryScoreRow } from "./memory-layer-carry";

describe("emitirEvidenciasCarry", () => {
  it("emite evidência quando o Carry real muda acima do limiar de 1pp", () => {
    const porTicker = new Map<string, CarryScoreRow[]>([
      ["PETR4", [
        { ticker: "PETR4", data: "2026-07-30", carry_real: 0.05 },
        { ticker: "PETR4", data: "2026-07-31", carry_real: 0.08 },
      ]],
    ]);
    const r = emitirEvidenciasCarry(porTicker);
    expect(r).toHaveLength(1);
    expect(r[0].pesoInformativo).toBe(1);
    expect(r[0].categoria).toBe("outro");
    expect(r[0].descricao).toContain("mudou de IPCA + 5%");
  });

  it("não emite nada quando a mudança fica abaixo do limiar", () => {
    const porTicker = new Map<string, CarryScoreRow[]>([
      ["PETR4", [
        { ticker: "PETR4", data: "2026-07-30", carry_real: 0.05 },
        { ticker: "PETR4", data: "2026-07-31", carry_real: 0.055 },
      ]],
    ]);
    const r = emitirEvidenciasCarry(porTicker);
    expect(r).toHaveLength(0);
  });

  it("nunca inventa comparação com um só ponto na série", () => {
    const porTicker = new Map<string, CarryScoreRow[]>([["PETR4", [{ ticker: "PETR4", data: "2026-07-31", carry_real: 0.05 }]]]);
    const r = emitirEvidenciasCarry(porTicker);
    expect(r).toHaveLength(0);
  });

  it("nunca inventa comparação quando falta carry_real em algum dos dois pontos", () => {
    const porTicker = new Map<string, CarryScoreRow[]>([
      ["PETR4", [
        { ticker: "PETR4", data: "2026-07-30", carry_real: null },
        { ticker: "PETR4", data: "2026-07-31", carry_real: 0.08 },
      ]],
    ]);
    const r = emitirEvidenciasCarry(porTicker);
    expect(r).toHaveLength(0);
  });

  it("marca 'caiu' e pesoInformativo negativo quando o Carry diminui", () => {
    const porTicker = new Map<string, CarryScoreRow[]>([
      ["PETR4", [
        { ticker: "PETR4", data: "2026-07-30", carry_real: 0.08 },
        { ticker: "PETR4", data: "2026-07-31", carry_real: 0.05 },
      ]],
    ]);
    const r = emitirEvidenciasCarry(porTicker);
    expect(r[0].pesoInformativo).toBe(-1);
    expect(r[0].titulo).toContain("caiu");
  });
});
