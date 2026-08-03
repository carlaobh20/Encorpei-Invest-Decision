import { describe, expect, it } from "vitest";
import { leituraGrowthVsCash } from "./leitura";
import type { DegrauCarry } from "./escada";

function degraus(growth: number | null, cash: number | null): DegrauCarry[] {
  const resultado = (v: number | null) =>
    v === null
      ? null
      : { carryReal: v, confianca: "media" as const, explicacao: "", fatores: [], versao: 1, metodo: "" };
  return [
    { nivel: 1, nome: "Carry Floor (piso)", resultado: resultado(0.06), pendencia: null },
    { nivel: 2, nome: "Carry Growth (+ reinvestimento)", resultado: resultado(growth), pendencia: null },
    { nivel: 3, nome: "Carry Cash (caixa em vez de lucro contábil)", resultado: resultado(cash), pendencia: null },
    { nivel: 4, nome: "Carry Allocation (o que chega ao acionista)", resultado: null, pendencia: "x" },
    { nivel: 5, nome: "Retorno Intrínseco (integra todos)", resultado: null, pendencia: "x" },
  ];
}

describe("leituraGrowthVsCash", () => {
  it("caso WEGE3: Growth muito acima do Cash → atenção", () => {
    const r = leituraGrowthVsCash(degraus(0.216, 0.024));
    expect(r?.direcao).toBe("atencao");
    expect(r?.texto).toContain("Growth bem acima do Cash");
  });

  it("caso INTB3: Cash igual ou acima do Growth → sustenta", () => {
    const r = leituraGrowthVsCash(degraus(0.119, 0.33));
    expect(r?.direcao).toBe("sustenta");
  });

  it("sem Growth ou sem Cash: null, nunca inventa leitura", () => {
    expect(leituraGrowthVsCash(degraus(null, 0.05))).toBeNull();
    expect(leituraGrowthVsCash(degraus(0.05, null))).toBeNull();
  });

  it("diferença moderada (cash entre 50% e 100% do growth): sem leitura — não é ruído", () => {
    const r = leituraGrowthVsCash(degraus(0.1, 0.07)); // cash = 70% do growth
    expect(r).toBeNull();
  });

  it("é determinístico", () => {
    const a = leituraGrowthVsCash(degraus(0.216, 0.024));
    const b = leituraGrowthVsCash(degraus(0.216, 0.024));
    expect(a).toEqual(b);
  });
});
