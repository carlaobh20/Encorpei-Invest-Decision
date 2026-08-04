import { describe, expect, it } from "vitest";
import { montarPainelMarketRadar } from "./market-radar";
import type { MudancaEvento } from "./market-scan-change-detection";
import type { ResultadoOportunidade } from "./opportunity-engine";

describe("montarPainelMarketRadar", () => {
  it("universo vazio: painel zerado, nunca quebra", () => {
    const p = montarPainelMarketRadar({
      universo: [], mudancas: [], oportunidades: [], statusPorTicker: new Map(), geradoEm: "2026-08-05T00:00:00Z",
    });
    expect(p.empresasMonitoradas).toBe(0);
    expect(p.tesesQuebradas).toEqual([]);
  });

  it("conta empresas alteradas só entre mudanças disponíveis (nunca as indisponíveis)", () => {
    const mudancas: MudancaEvento[] = [
      { ticker: "A3", dimensao: "carry", disponivel: true, motivo: null, direcao: "melhorou", texto: "x" },
      { ticker: "B3", dimensao: "fluxo", disponivel: false, motivo: "sem fonte", direcao: null, texto: "" },
    ];
    const p = montarPainelMarketRadar({
      universo: ["A3", "B3"], mudancas, oportunidades: [], statusPorTicker: new Map(), geradoEm: "x",
    });
    expect(p.empresasAlteradas).toBe(1);
  });

  it("teses quebradas e fortalecidas classificadas pelo Status Derivado", () => {
    const status = new Map<string, "quebrada" | "fortalecendo" | "confirmada">([
      ["A3", "quebrada"], ["B3", "fortalecendo"], ["C3", "confirmada"],
    ]);
    const p = montarPainelMarketRadar({
      universo: ["A3", "B3", "C3"], mudancas: [], oportunidades: [],
      statusPorTicker: status as Map<string, import("./thesis-engine").StatusDerivadoTese>,
      geradoEm: "x",
    });
    expect(p.tesesQuebradas.map((t) => t.ticker)).toEqual(["A3"]);
    expect(p.tesesFortalecidas).toEqual(["B3"]);
  });

  it("conta oportunidades só entre as que têm nível (não null)", () => {
    const oportunidades: ResultadoOportunidade[] = [
      { ticker: "A3", nivel: "boa", porQueApareceu: "x", oQueMudou: "x", risco: "x", confianca: "media" },
      { ticker: "B3", nivel: null, porQueApareceu: "x", oQueMudou: "x", risco: "x", confianca: "baixa" },
    ];
    const p = montarPainelMarketRadar({
      universo: ["A3", "B3"], mudancas: [], oportunidades, statusPorTicker: new Map(), geradoEm: "x",
    });
    expect(p.novasOportunidades).toBe(1);
  });

  it("eventos relevantes ficam limitados a 20 e só direções melhorou/piorou", () => {
    const mudancas: MudancaEvento[] = Array.from({ length: 25 }, (_, i) => ({
      ticker: `T${i}3`, dimensao: "carry", disponivel: true, motivo: null, direcao: "melhorou", texto: "x",
    } as MudancaEvento));
    mudancas.push({ ticker: "N3", dimensao: "carry", disponivel: true, motivo: null, direcao: "neutro", texto: "x" });
    const p = montarPainelMarketRadar({ universo: [], mudancas, oportunidades: [], statusPorTicker: new Map(), geradoEm: "x" });
    expect(p.eventosRelevantes.length).toBe(20);
    expect(p.eventosRelevantes.every((e) => e.direcao !== "neutro")).toBe(true);
  });
});
