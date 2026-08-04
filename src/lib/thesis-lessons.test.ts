import { describe, expect, it } from "vitest";
import { gerarThesisLessons } from "./thesis-lessons";
import type { InvestmentStory } from "./investment-story-narrativa";

const STORY_BASE: InvestmentStory = {
  quemE: "Empresa X (TICK3) — Setor Y, Compounder.",
  porQueInteressante: "Confluence 80.",
  oQueFortalece: ["ROIC consistente acima de 20%.", "Margem em expansão."],
  oQueEnfraquece: ["Dívida líquida crescente."],
  principalRisco: "Dívida líquida crescente.",
  principalCatalisador: "ROIC consistente acima de 20%.",
  evidenciasUsadas: 0,
};

describe("gerarThesisLessons", () => {
  it("reaproveita oQueFortalece/oQueEnfraquece sem reprocessar", () => {
    const r = gerarThesisLessons({ story: STORY_BASE, roicComparacaoSetor: "acima", carryComparacaoSetor: "na_media" });
    expect(r.caracteristicasCompounder).toEqual(STORY_BASE.oQueFortalece);
    expect(r.errosQuePodemDestruir).toEqual(STORY_BASE.oQueEnfraquece);
  });

  it("sem oQueFortalece, cai numa frase honesta em vez de lista vazia", () => {
    const r = gerarThesisLessons({ story: { ...STORY_BASE, oQueFortalece: [] }, roicComparacaoSetor: "indisponivel", carryComparacaoSetor: "indisponivel" });
    expect(r.caracteristicasCompounder).toEqual(["Nenhuma característica de força identificada pelo Explanation Engine hoje."]);
  });

  it("sem oQueEnfraquece, usa principalRisco como fallback", () => {
    const r = gerarThesisLessons({ story: { ...STORY_BASE, oQueEnfraquece: [] }, roicComparacaoSetor: "indisponivel", carryComparacaoSetor: "indisponivel" });
    expect(r.errosQuePodemDestruir).toEqual([STORY_BASE.principalRisco]);
  });

  it("diferencial de concorrentes combina ROIC e Carry quando ambos disponíveis", () => {
    const r = gerarThesisLessons({ story: STORY_BASE, roicComparacaoSetor: "acima", carryComparacaoSetor: "abaixo" });
    expect(r.diferencialConcorrentes).toContain("ROIC acima da média do setor hoje");
    expect(r.diferencialConcorrentes).toContain("Carry abaixo da média do setor hoje");
  });

  it("sem nenhuma comparação de setor disponível, resposta honesta com motivo — nunca inventa diferencial", () => {
    const r = gerarThesisLessons({ story: STORY_BASE, roicComparacaoSetor: "indisponivel", carryComparacaoSetor: "indisponivel" });
    expect(r.diferencialConcorrentes).toBe("Sem comparação de setor disponível hoje — setor não classificado ou sem outra empresa do mesmo setor com dado suficiente.");
  });
});
