import { describe, expect, it } from "vitest";
import { DICIONARIO_TERMOS, TRADUCAO_INDICADORES, buscarTermo, buscarTraducaoIndicador } from "./simplicity-dicionario";

describe("dicionário de termos", () => {
  it("todo termo tem definição não vazia e diferente do próprio termo", () => {
    for (const [chave, t] of Object.entries(DICIONARIO_TERMOS)) {
      expect(t.definicao.length).toBeGreaterThan(10);
      expect(t.definicao).not.toBe(t.termo);
      expect(chave).toBe(chave.toLowerCase());
    }
  });

  it("inclui os 9 termos citados como exemplo na spec", () => {
    const chaves = Object.keys(DICIONARIO_TERMOS);
    for (const esperado of ["tese", "confluence", "carry", "portfolio_fit", "conviccao", "catalisador", "risco", "replay", "investment_story"]) {
      expect(chaves).toContain(esperado);
    }
  });

  it("buscarTermo devolve null pra chave inexistente, nunca inventa", () => {
    expect(buscarTermo("nao_existe")).toBeNull();
  });
});

describe("tradução de indicadores", () => {
  it("carry, roic, p_l e p_vp batem com os exemplos literais da spec", () => {
    expect(TRADUCAO_INDICADORES.carry.significado).toBe("Proteção esperada do patrimônio acima da inflação.");
    expect(TRADUCAO_INDICADORES.roic.significado).toBe("Eficiência da empresa em transformar capital em lucro.");
    expect(TRADUCAO_INDICADORES.p_l.significado).toBe("Quantos anos de lucro o mercado está pagando hoje.");
    expect(TRADUCAO_INDICADORES.p_vp.significado).toBe("Quanto o mercado paga sobre o patrimônio líquido.");
  });

  it("toda tradução mostra a sigla, nunca só o significado sem contexto", () => {
    for (const t of Object.values(TRADUCAO_INDICADORES)) {
      expect(t.sigla.length).toBeGreaterThan(0);
      expect(t.significado.length).toBeGreaterThan(10);
    }
  });

  it("buscarTraducaoIndicador devolve null pra indicador não catalogado", () => {
    expect(buscarTraducaoIndicador("indicador_desconhecido")).toBeNull();
  });
});
