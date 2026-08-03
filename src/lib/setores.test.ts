import { describe, expect, it } from "vitest";
import {
  INDICADORES_EXCLUIDOS,
  MODELO_POR_TICKER,
  ehModeloFinanceiro,
  indicadorPermitido,
  modeloDe,
} from "./setores";

/**
 * Sector Intelligence — regras duras exigidas pelo prompt de 03/08/2026:
 * nenhum banco com EBITDA/dívida, nenhuma seguradora com métricas
 * industriais. Se alguém violar, o CI quebra.
 */

describe("classificação por modelo", () => {
  it("as 40 empresas do universo têm modelo identificado", () => {
    expect(Object.keys(MODELO_POR_TICKER)).toHaveLength(40);
  });

  it("casos-âncora do prompt", () => {
    expect(modeloDe("WEGE3")).toBe("industrial");
    expect(modeloDe("ITUB4")).toBe("banco");
    expect(modeloDe("PSSA3")).toBe("seguradora");
    expect(modeloDe("MULT3")).toBe("shopping_imobiliario");
    expect(modeloDe("VALE3")).toBe("commodities");
    expect(modeloDe("RADL3")).toBe("varejo");
    expect(modeloDe("TOTS3")).toBe("software");
  });
});

describe("indicadores proibidos por modelo", () => {
  const bancos = Object.entries(MODELO_POR_TICKER)
    .filter(([, m]) => m === "banco")
    .map(([t]) => t);
  const seguradoras = Object.entries(MODELO_POR_TICKER)
    .filter(([, m]) => m === "seguradora")
    .map(([t]) => t);

  it("NENHUM banco usa EBITDA, dívida líquida ou dívida/patrimônio", () => {
    expect(bancos.length).toBeGreaterThan(0);
    for (const b of bancos) {
      expect(indicadorPermitido(b, "ebitda")).toBe(false);
      expect(indicadorPermitido(b, "divida_liquida")).toBe(false);
      expect(indicadorPermitido(b, "alavancagem")).toBe(false);
      expect(indicadorPermitido(b, "roic")).toBe(false);
    }
  });

  it("NENHUMA seguradora usa indicadores industriais de dívida/ROIC", () => {
    expect(seguradoras.length).toBeGreaterThan(0);
    for (const s of seguradoras) {
      expect(indicadorPermitido(s, "roic")).toBe(false);
      expect(indicadorPermitido(s, "divida_liquida")).toBe(false);
    }
  });

  it("industriais mantêm ROIC e dívida (não sobre-excluir)", () => {
    expect(indicadorPermitido("WEGE3", "roic")).toBe(true);
    expect(indicadorPermitido("WEGE3", "divida_liquida")).toBe(true);
  });

  it("toda lista de exclusão referencia modelos válidos", () => {
    for (const m of Object.values(MODELO_POR_TICKER)) {
      expect(INDICADORES_EXCLUIDOS[m]).toBeDefined();
    }
  });
});

describe("ehModeloFinanceiro — auditoria de 03/08/2026", () => {
  /**
   * Antes desta função existir, radar.ts/compounder-dados.ts/comparar
   * calculavam "é financeira?" olhando se roic/divida_liquida vieram NULL
   * no banco — dado, não modelo. Isso fazia BBDC4, BBAS3, BBSE3 e CXSE3
   * (cujos filings da CVM às vezes populam esses campos por acidente)
   * serem tratados como não-financeiras, exibindo dívida/ROIC industriais
   * que não existem para um banco/seguradora. Esta função tem que valer
   * SEMPRE para todo banco e toda seguradora, não importa o que está (ou
   * não está) preenchido no banco de dados.
   */
  it("todo banco é modelo financeiro, independentemente do dado bruto", () => {
    for (const [t, m] of Object.entries(MODELO_POR_TICKER)) {
      if (m === "banco") expect(ehModeloFinanceiro(t)).toBe(true);
    }
  });

  it("toda seguradora é modelo financeiro, independentemente do dado bruto", () => {
    for (const [t, m] of Object.entries(MODELO_POR_TICKER)) {
      if (m === "seguradora") expect(ehModeloFinanceiro(t)).toBe(true);
    }
  });

  it("casos-âncora do prompt de 31/08: BBDC4/BBAS3/BBSE3/CXSE3 nunca aparecem como industriais", () => {
    expect(ehModeloFinanceiro("BBDC4")).toBe(true);
    expect(ehModeloFinanceiro("BBAS3")).toBe(true);
    expect(ehModeloFinanceiro("BBSE3")).toBe(true);
    expect(ehModeloFinanceiro("CXSE3")).toBe(true);
  });

  it("industriais e infraestrutura financeira (B3SA3) não são 'financeira' nesta régua", () => {
    expect(ehModeloFinanceiro("WEGE3")).toBe(false);
    expect(ehModeloFinanceiro("B3SA3")).toBe(false);
  });

  it("ticker sem modelo cadastrado nunca é considerado financeiro (não estima)", () => {
    expect(ehModeloFinanceiro("TICKER_INEXISTENTE")).toBe(false);
  });
});
