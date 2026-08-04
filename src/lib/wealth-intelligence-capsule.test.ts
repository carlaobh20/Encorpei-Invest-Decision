import { describe, expect, it } from "vitest";
import { montarIntelligenceCapsulePatrimonio } from "./wealth-intelligence-capsule";
import { montarWealthHealth } from "./wealth-health";

const WEALTH_HEALTH = montarWealthHealth({
  confluenceMedio: 80,
  carryMedioPonderado: 0.1,
  concentracaoRotulo: "baixa",
  liquidezRotulo: "alta",
  qualityMedioPonderado: 30,
  portfolioFitMedioPonderado: 80,
  drawdownEsperadoMedioPonderado: -0.1,
});

describe("montarIntelligenceCapsulePatrimonio", () => {
  it("sem teses quebradas e FDIE ok, precisoAgir é false", () => {
    const r = montarIntelligenceCapsulePatrimonio({
      wealthHealth: WEALTH_HEALTH,
      tesesQuebradas: 0,
      totalTeses: 5,
      fdie: { ok: 5, alerta: 0, critico: 0, total: 5 },
      gapMetaTexto: null,
    });
    expect(r.precisoAgir).toBe(false);
    expect(r.porQueImporta).toContain("Nenhuma das 5 teses");
  });

  it("com tese quebrada, precisoAgir vira true e o motivo cita a quebra", () => {
    const r = montarIntelligenceCapsulePatrimonio({
      wealthHealth: WEALTH_HEALTH,
      tesesQuebradas: 1,
      totalTeses: 5,
      fdie: { ok: 5, alerta: 0, critico: 0, total: 5 },
      gapMetaTexto: null,
    });
    expect(r.precisoAgir).toBe(true);
    expect(r.precisoAgirMotivo).toContain("quebrada");
  });

  it("componente mais fraco (quality, 30 no cenário) aparece como maior risco", () => {
    const r = montarIntelligenceCapsulePatrimonio({
      wealthHealth: WEALTH_HEALTH,
      tesesQuebradas: 0,
      totalTeses: 1,
      fdie: { ok: 1, alerta: 0, critico: 0, total: 1 },
      gapMetaTexto: null,
    });
    expect(r.maiorRisco).toContain("Quality Score");
  });

  it("gapMetaTexto, quando fornecido, aparece em porQueImporta", () => {
    const r = montarIntelligenceCapsulePatrimonio({
      wealthHealth: WEALTH_HEALTH,
      tesesQuebradas: 0,
      totalTeses: 1,
      fdie: { ok: 1, alerta: 0, critico: 0, total: 1 },
      gapMetaTexto: "Sua meta patrimonial continua alcançável no CAGR atual.",
    });
    expect(r.porQueImporta).toContain("Sua meta patrimonial continua alcançável");
  });

  it("FDIE crítico em alguma posição vira precisoAgir true mesmo sem tese quebrada", () => {
    const r = montarIntelligenceCapsulePatrimonio({
      wealthHealth: WEALTH_HEALTH,
      tesesQuebradas: 0,
      totalTeses: 1,
      fdie: { ok: 0, alerta: 0, critico: 1, total: 1 },
      gapMetaTexto: null,
    });
    expect(r.precisoAgir).toBe(true);
    expect(r.precisoAgirMotivo).toContain("FDIE");
  });
});
