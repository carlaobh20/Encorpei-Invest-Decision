import { describe, expect, it } from "vitest";
import { montarContextoDecisao } from "./decision-journal";

describe("montarContextoDecisao", () => {
  it("monta a foto completa com versaoContexto explícita", () => {
    const c = montarContextoDecisao({
      ticker: "INTB3",
      statusTese: "valida",
      scoreFinal: 78,
      confluenceV2: null,
      carryReal: 0.08,
      carryVersao: 1,
      technicalScore: 60,
      precoNaDecisao: 25.5,
      fdieResumo: { ok: 5, alerta: 1, critico: 0, total: 6 },
    });
    expect(c.versaoContexto).toBe(2);
    expect(c.ticker).toBe("INTB3");
    expect(c.scoreFinal).toBe(78);
    expect(c.fdieResumo?.critico).toBe(0);
  });

  it("aceita tudo null sem quebrar — corte honesto, nunca inventa", () => {
    const c = montarContextoDecisao({
      ticker: "XYZW3",
      statusTese: null,
      scoreFinal: null,
      confluenceV2: null,
      carryReal: null,
      carryVersao: null,
      technicalScore: null,
      precoNaDecisao: null,
      fdieResumo: null,
    });
    expect(c.versaoContexto).toBe(2);
    expect(c.scoreFinal).toBeNull();
    expect(c.fdieResumo).toBeNull();
  });
});
