import { describe, expect, it } from "vitest";
import { lucroLTM, roicMedia4Tri } from "./fundamentos";

/**
 * Lucro dos últimos 12 meses — a regra que alimenta o Valuation.
 * Fórmula: DFP anual + ITRs posteriores − ITRs equivalentes do ano anterior.
 */

describe("lucroLTM", () => {
  it("DFP 2025 + 1T26 − 1T25 (caso padrão do universo)", () => {
    const funds = [
      { competencia: "2026-03-31", fonte: "cvm_itr", lucro_liquido: 300 },
      { competencia: "2025-12-31", fonte: "cvm_dfp", lucro_liquido: 1000 },
      { competencia: "2025-09-30", fonte: "cvm_itr", lucro_liquido: 280 },
      { competencia: "2025-06-30", fonte: "cvm_itr", lucro_liquido: 240 },
      { competencia: "2025-03-31", fonte: "cvm_itr", lucro_liquido: 200 },
    ];
    // 1000 + 300 − 200 = 1100
    expect(lucroLTM(funds)).toBe(1100);
  });

  it("sem DFP: devolve null — nunca anualiza no chute", () => {
    expect(
      lucroLTM([{ competencia: "2026-03-31", fonte: "cvm_itr", lucro_liquido: 300 }])
    ).toBeNull();
  });

  it("falta o trimestre equivalente do ano anterior: devolve null", () => {
    const funds = [
      { competencia: "2026-03-31", fonte: "cvm_itr", lucro_liquido: 300 },
      { competencia: "2025-12-31", fonte: "cvm_dfp", lucro_liquido: 1000 },
      // 2025-03-31 ausente
    ];
    expect(lucroLTM(funds)).toBeNull();
  });

  it("sem ITR posterior à DFP: LTM = o próprio anual", () => {
    const funds = [
      { competencia: "2025-12-31", fonte: "cvm_dfp", lucro_liquido: 1000 },
      { competencia: "2025-09-30", fonte: "cvm_itr", lucro_liquido: 280 },
    ];
    expect(lucroLTM(funds)).toBe(1000);
  });

  it("DFP com lucro null: devolve null", () => {
    expect(
      lucroLTM([{ competencia: "2025-12-31", fonte: "cvm_dfp", lucro_liquido: null }])
    ).toBeNull();
  });
});

describe("roicMedia4Tri", () => {
  it("média dos até 4 ITRs mais recentes, ignorando DFP e nulls", () => {
    const funds = [
      { fonte: "cvm_itr", roic: 0.12 },
      { fonte: "cvm_dfp", roic: 0.2 }, // ignorado (anual)
      { fonte: "cvm_itr", roic: 0.1 },
      { fonte: "cvm_itr", roic: null }, // ignorado
      { fonte: "cvm_itr", roic: 0.08 },
      { fonte: "cvm_itr", roic: 0.06 },
    ];
    // (0.12 + 0.10 + 0.08 + 0.06) / 4 = 0.09
    expect(roicMedia4Tri(funds)).toBeCloseTo(0.09, 10);
  });

  it("sem ITR com ROIC: devolve null", () => {
    expect(roicMedia4Tri([{ fonte: "cvm_dfp", roic: 0.2 }])).toBeNull();
  });
});
