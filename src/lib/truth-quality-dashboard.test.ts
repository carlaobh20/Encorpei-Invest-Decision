import { describe, expect, it } from "vitest";
import { montarQualityDashboard, type EntradaDashboardEmpresa } from "./truth-quality-dashboard";
import type { DataQualityScore } from "./truth-quality-score";

function score(over: Partial<DataQualityScore> = {}): DataQualityScore {
  return {
    ticker: "PETR4",
    score: 90,
    ultimaAuditoria: null,
    indicadoresConfirmados: 3,
    indicadoresDivergentes: 0,
    camposPendentes: 0,
    indicadoresEsperadosTotal: 3,
    ...over,
  };
}

describe("montarQualityDashboard", () => {
  it("calcula score médio geral e conta confirmados (>=80) e pendentes (camposPendentes > 0)", () => {
    const entradas: EntradaDashboardEmpresa[] = [
      { score: score({ ticker: "PETR4", score: 100 }), setor: "commodities" },
      { score: score({ ticker: "VALE3", score: 60, camposPendentes: 1 }), setor: "commodities" },
    ];
    const r = montarQualityDashboard(entradas);
    expect(r.empresasTotal).toBe(2);
    expect(r.scoreMedioGeral).toBe(80);
    expect(r.confirmados).toBe(1);
    expect(r.pendentes).toBe(1);
  });

  it("agrupa por setor e calcula a média de cada um", () => {
    const entradas: EntradaDashboardEmpresa[] = [
      { score: score({ ticker: "ITUB4", score: 100 }), setor: "banco" },
      { score: score({ ticker: "BBAS3", score: 80 }), setor: "banco" },
      { score: score({ ticker: "WEGE3", score: 90 }), setor: "industrial" },
    ];
    const r = montarQualityDashboard(entradas);
    const banco = r.porSetor.find((s) => s.setor === "banco");
    expect(banco?.empresas).toBe(2);
    expect(banco?.scoreMedio).toBe(90);
  });

  it("conta empresas sem setor separadamente, sem incluir no agrupamento por setor", () => {
    const entradas: EntradaDashboardEmpresa[] = [{ score: score(), setor: null }];
    const r = montarQualityDashboard(entradas);
    expect(r.semSetor).toBe(1);
    expect(r.porSetor).toHaveLength(0);
  });

  it("lista vazia não quebra (0, não NaN)", () => {
    const r = montarQualityDashboard([]);
    expect(r.scoreMedioGeral).toBe(0);
    expect(r.empresasTotal).toBe(0);
  });
});
