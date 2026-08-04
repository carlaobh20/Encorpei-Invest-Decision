import { describe, expect, it } from "vitest";
import { gerarInvestmentStory } from "./investment-story-narrativa";
import type { Decision } from "./decision-object";

function decision(campos: Partial<Decision>): Decision {
  return {
    confluence: null,
    conviccao: "indefinida",
    evidences: [],
    explanation: { ticker: "X", confluenceScore: null, conviccao: "indefinida", motivosPositivos: [], motivosNegativos: [], avisos: [], geradoEm: "x" },
    ...campos,
  } as unknown as Decision;
}

describe("gerarInvestmentStory", () => {
  it("nunca usa teses.texto — só Explanation Engine + Evidence Engine", () => {
    const story = gerarInvestmentStory({
      ticker: "WEGE3",
      empresa: "WEG",
      setor: "Bens de Capital",
      modeloNegocio: null,
      decision: decision({
        confluence: 75,
        conviccao: "alta",
        explanation: {
          ticker: "WEGE3", confluenceScore: 75, conviccao: "alta", geradoEm: "x", avisos: [],
          motivosPositivos: [{ texto: "ROIC de 31% no Confluence.", origem: "confluence:quality", peso: 0.3 }],
          motivosNegativos: [{ texto: "Valuation elevado no Carry.", origem: "carry", peso: null }],
        },
      }),
    });
    expect(story.porQueInteressante).toMatch(/ROIC de 31%/);
    expect(story.principalRisco).toMatch(/Valuation elevado/);
    expect(story.oQueFortalece).toContain("ROIC de 31% no Confluence.");
  });

  it("sem evidências ativas (Evidence Engine sem coletor em produção): evidenciasUsadas é 0, nunca escondido", () => {
    const story = gerarInvestmentStory({ ticker: "X", empresa: "X", setor: null, modeloNegocio: null, decision: decision({}) });
    expect(story.evidenciasUsadas).toBe(0);
  });

  it("sem Confluence calculável: diz isso explicitamente, nunca inventa 'interessante'", () => {
    const story = gerarInvestmentStory({ ticker: "X", empresa: "X", setor: null, modeloNegocio: null, decision: decision({ confluence: null }) });
    expect(story.porQueInteressante).toMatch(/indisponível/i);
  });

  it("sem motivo negativo: principalRisco explica a ausência, não inventa risco", () => {
    const story = gerarInvestmentStory({ ticker: "X", empresa: "X", setor: null, modeloNegocio: null, decision: decision({}) });
    expect(story.principalRisco).toMatch(/Nenhum motivo negativo/);
  });
});
