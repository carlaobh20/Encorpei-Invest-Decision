import { describe, expect, it } from "vitest";
import { gerarDecisionFeed, type DecisionFeedEntrada } from "./decision-feed";

const base: DecisionFeedEntrada = {
  ticker: "WEGE3",
  nome: "WEG",
  statusTese: "valida",
  teseTecnica: "sim",
  timingFavoravel: true,
  fraseTiming: "Momento Favorável",
};

describe("gerarDecisionFeed", () => {
  it("tese quebrada → reduzir prioridade, independente do gráfico", () => {
    const [r] = gerarDecisionFeed([{ ...base, statusTese: "quebrada", teseTecnica: "sim", timingFavoravel: true }]);
    expect(r.sugestao).toBe("reduzir_prioridade");
  });

  it("tese em revisão → aguardar melhor ponto", () => {
    const [r] = gerarDecisionFeed([{ ...base, statusTese: "em_revisao" }]);
    expect(r.sugestao).toBe("aguardar_melhor_ponto");
  });

  it("tese válida mas gráfico não confirma → aguardar melhor ponto", () => {
    const [r] = gerarDecisionFeed([{ ...base, teseTecnica: "nao" }]);
    expect(r.sugestao).toBe("aguardar_melhor_ponto");
  });

  it("tese válida + gráfico confirma + timing favorável → aumentar prioridade", () => {
    const [r] = gerarDecisionFeed([base]);
    expect(r.sugestao).toBe("aumentar_prioridade");
  });

  it("tese válida parcialmente confirmada → nenhuma ação (sem sinal forte)", () => {
    const [r] = gerarDecisionFeed([{ ...base, teseTecnica: "parcialmente" }]);
    expect(r.sugestao).toBe("nenhuma_acao");
  });

  it("NUNCA usa 'comprar'/'vender'/'compre'/'venda' em nenhuma explicação ou rótulo — regra 7 do CLAUDE.md", () => {
    const cenarios: DecisionFeedEntrada[] = [
      { ...base, statusTese: "quebrada" },
      { ...base, statusTese: "em_revisao" },
      { ...base, teseTecnica: "nao" },
      { ...base, teseTecnica: "sim", timingFavoravel: true },
      { ...base, teseTecnica: "parcialmente" },
      { ...base, teseTecnica: "sem_tese", statusTese: null },
    ];
    const proibidas = /\b(comprar|compre|compra|vender|venda|vend[ae])\b/i;
    for (const item of gerarDecisionFeed(cenarios)) {
      expect(item.explicacao).not.toMatch(proibidas);
    }
  });
});
