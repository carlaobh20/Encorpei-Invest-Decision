import { describe, expect, it } from "vitest";
import { calcularDataQualityScore, type EntradaQualityScore } from "./truth-quality-score";

const base: EntradaQualityScore = {
  ticker: "PETR4",
  estrelasPorIndicador: { receita: 5, margem: 5, roic: 5 },
  verificacoesFdie: [],
  ultimaAuditoria: "2026-08-01T00:00:00.000Z",
};

describe("calcularDataQualityScore", () => {
  it("dá 100 quando todos os indicadores são 5 estrelas e não há verificação crítica/alerta", () => {
    const r = calcularDataQualityScore(base, ["receita", "margem", "roic"]);
    expect(r.score).toBe(100);
    expect(r.camposPendentes).toBe(0);
  });

  it("penaliza verificação crítica do FDIE em 15 pontos", () => {
    const r = calcularDataQualityScore(
      { ...base, verificacoesFdie: [{ id: "x", nome: "x", severidade: "critico", mensagem: "erro" }] },
      ["receita", "margem", "roic"]
    );
    expect(r.score).toBe(85);
  });

  it("penaliza alerta do FDIE em 5 pontos", () => {
    const r = calcularDataQualityScore(
      { ...base, verificacoesFdie: [{ id: "x", nome: "x", severidade: "alerta", mensagem: "aviso" }] },
      ["receita", "margem", "roic"]
    );
    expect(r.score).toBe(95);
  });

  it("nunca vai abaixo de 0, mesmo com muitos críticos", () => {
    const r = calcularDataQualityScore(
      {
        ...base,
        estrelasPorIndicador: { receita: 1 },
        verificacoesFdie: Array.from({ length: 10 }, (_, i) => ({ id: `x${i}`, nome: "x", severidade: "critico" as const, mensagem: "erro" })),
      },
      ["receita"]
    );
    expect(r.score).toBe(0);
  });

  it("conta campos pendentes quando um indicador esperado não tem estrela registrada", () => {
    const r = calcularDataQualityScore(base, ["receita", "margem", "roic", "carry"]);
    expect(r.camposPendentes).toBe(1);
    expect(r.indicadoresEsperadosTotal).toBe(4);
  });

  it("sempre reporta indicadoresDivergentes = 0 — Multi-Source Validation não existe ainda, nunca infere divergência", () => {
    const r = calcularDataQualityScore(base, ["receita"]);
    expect(r.indicadoresDivergentes).toBe(0);
  });

  it("sem nenhum indicador com estrela, score fica 0 (média de zero indicadores é 0, não é omitido)", () => {
    const r = calcularDataQualityScore({ ...base, estrelasPorIndicador: {} }, ["receita"]);
    expect(r.score).toBe(0);
    expect(r.camposPendentes).toBe(1);
  });

  it("passa a última auditoria adiante sem recalcular nem inventar timestamp", () => {
    const r = calcularDataQualityScore(base, []);
    expect(r.ultimaAuditoria).toBe("2026-08-01T00:00:00.000Z");
  });
});
