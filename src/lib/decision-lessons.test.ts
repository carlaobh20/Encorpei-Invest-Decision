import { describe, expect, it } from "vitest";
import { gerarDecisionLesson } from "./decision-lessons";

describe("gerarDecisionLesson", () => {
  it("porQueApareceu é sempre o motivo real recebido, nunca reescrito", () => {
    const r = gerarDecisionLesson({ titulo: "Tese quebrada — decidir o que fazer", motivo: "Tese quebrada — decidir o que fazer" });
    expect(r.porQueApareceu).toBe("Tese quebrada — decidir o que fazer");
  });

  it("cada um dos 7 títulos conhecidos de classificarUrgencia tem um conceito específico (não cai no padrão)", () => {
    const titulos = [
      "Integridade de dado comprometida — checar a fonte",
      "Tese quebrada — decidir o que fazer",
      "Tese invalidada manualmente — decidir o que fazer",
      "Tese enfraquecendo — reavaliar premissas",
      "Alerta crítico recente",
      "Alerta importante recente",
      "Tese fortalecendo — vale aprofundar",
      "Acompanhamento de rotina",
    ];
    const padrao = gerarDecisionLesson({ titulo: "título desconhecido qualquer", motivo: "x" }).conceito;
    for (const titulo of titulos) {
      const r = gerarDecisionLesson({ titulo, motivo: "x" });
      expect(r.conceito).not.toBe(padrao);
      expect(r.conceito.length).toBeGreaterThan(0);
    }
  });

  it("título desconhecido cai no conceito padrão, nunca quebra", () => {
    const r = gerarDecisionLesson({ titulo: "algo que classificarUrgencia nunca produziria", motivo: "y" });
    expect(r.conceito).toContain("sinal já calculado pelo sistema mudou");
  });
});
