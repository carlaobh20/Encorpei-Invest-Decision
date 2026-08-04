import { describe, expect, it } from "vitest";
import { emitirEvidenciasResultados, type FundamentoAnualRow } from "./memory-layer-resultados";

function serie(ticker: string, rows: Omit<FundamentoAnualRow, "ticker">[]): [string, FundamentoAnualRow[]] {
  return [ticker, rows.map((r) => ({ ...r, ticker }))];
}

describe("emitirEvidenciasResultados", () => {
  it("emite evidência de receita aumentou quando a variação passa do limiar de 10%", () => {
    const porTicker = new Map([
      serie("PETR4", [
        { competencia: "2025", receita_liquida: 100, lucro_liquido: 10, margem_liquida: 10, roic: 15 },
        { competencia: "2026", receita_liquida: 120, lucro_liquido: 10, margem_liquida: 10, roic: 15 },
      ]),
    ]);
    const r = emitirEvidenciasResultados(porTicker);
    const receita = r.find((e) => e.categoria === "receita");
    expect(receita).toBeDefined();
    expect(receita!.pesoInformativo).toBe(1);
    expect(receita!.descricao).toContain("aumentou");
    expect(receita!.subcategoria).toBe("Financeiro");
  });

  it("emite lucro como categoria 'outro' (sem valor dedicado no enum congelado) mas mantém a comparação real", () => {
    const porTicker = new Map([
      serie("VALE3", [
        { competencia: "2025", receita_liquida: 100, lucro_liquido: 10, margem_liquida: 10, roic: 15 },
        { competencia: "2026", receita_liquida: 100, lucro_liquido: 5, margem_liquida: 10, roic: 15 },
      ]),
    ]);
    const r = emitirEvidenciasResultados(porTicker);
    const lucro = r.find((e) => e.titulo.startsWith("Lucro líquido"));
    expect(lucro).toBeDefined();
    expect(lucro!.categoria).toBe("outro");
    expect(lucro!.pesoInformativo).toBe(-1);
    expect(lucro!.descricao).toContain("caiu");
  });

  it("não emite nada quando a variação fica abaixo do limiar (ruído de arredondamento)", () => {
    const porTicker = new Map([
      serie("ITUB4", [
        { competencia: "2025", receita_liquida: 100, lucro_liquido: 10, margem_liquida: 10, roic: 15 },
        { competencia: "2026", receita_liquida: 102, lucro_liquido: 10.2, margem_liquida: 10.1, roic: 15.1 },
      ]),
    ]);
    const r = emitirEvidenciasResultados(porTicker);
    expect(r).toHaveLength(0);
  });

  it("nunca inventa comparação quando só existe uma competência (sem par anterior)", () => {
    const porTicker = new Map([serie("BBAS3", [{ competencia: "2026", receita_liquida: 100, lucro_liquido: 10, margem_liquida: 10, roic: 15 }])]);
    const r = emitirEvidenciasResultados(porTicker);
    expect(r).toHaveLength(0);
  });

  it("nunca inventa comparação quando falta um dos dois valores (null)", () => {
    const porTicker = new Map([
      serie("BBAS3", [
        { competencia: "2025", receita_liquida: null, lucro_liquido: 10, margem_liquida: 10, roic: 15 },
        { competencia: "2026", receita_liquida: 120, lucro_liquido: 10, margem_liquida: 10, roic: 15 },
      ]),
    ]);
    const r = emitirEvidenciasResultados(porTicker);
    expect(r.find((e) => e.categoria === "receita")).toBeUndefined();
  });
});
