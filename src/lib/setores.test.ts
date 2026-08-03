import { describe, expect, it } from "vitest";
import {
  INDICADORES_EXCLUIDOS,
  MODELO_POR_TICKER,
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
