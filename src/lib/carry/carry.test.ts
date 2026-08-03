import { describe, expect, it } from "vitest";
import { carryVigente } from "./index";
import type { CarryEntrada } from "./types";

/** Carry Engine — determinístico, explicado, e com trava de linguagem. */

const base: CarryEntrada = {
  lucroLtm: 600_000_000,
  marketCap: 10_000_000_000, // carry = 6%
  roic4: 0.2,
  margensDesvio: 0.02,
  caixaLiquido: true,
  alavancagem: null,
  crescReceitaAnual: 0.1,
  ehFinanceira: false,
};

describe("Carry v1 (piso conservador)", () => {
  it("empresa de qualidade: IPCA + 6% com fatores de sustentação", () => {
    const r = carryVigente().calcular(base);
    expect(r.carryReal).toBeCloseTo(0.06, 10);
    expect(r.confianca).toBe("alta");
    expect(r.fatores.filter((f) => f.direcao === "sustenta").length).toBeGreaterThanOrEqual(3);
    expect(r.explicacao).toContain("IPCA + 6%");
  });

  it("prejuízo: carry null com explicação — nunca inventa", () => {
    const r = carryVigente().calcular({ ...base, lucroLtm: -100 });
    expect(r.carryReal).toBeNull();
    expect(r.explicacao).toContain("não teve lucro");
  });

  it("sem valor de mercado: carry null", () => {
    const r = carryVigente().calcular({ ...base, marketCap: null });
    expect(r.carryReal).toBeNull();
  });

  it("preço exigente vira fator de atenção", () => {
    const r = carryVigente().calcular({ ...base, marketCap: 30_000_000_000 }); // 2%
    expect(r.fatores.some((f) => f.direcao === "atencao" && f.texto.includes("Preço exigente"))).toBe(true);
  });

  it("financeira: confiança baixa e aviso explícito", () => {
    const r = carryVigente().calcular({ ...base, ehFinanceira: true });
    expect(r.confianca).toBe("baixa");
    expect(r.fatores.some((f) => f.texto.includes("seguradora") || f.texto.includes("Banco"))).toBe(true);
  });

  it("dívida alta vira fator de atenção", () => {
    const r = carryVigente().calcular({ ...base, caixaLiquido: false, alavancagem: 1.5 });
    expect(r.fatores.some((f) => f.direcao === "atencao" && f.texto.includes("Dívida"))).toBe(true);
  });

  it("TRAVA DE LINGUAGEM: nunca promete, nunca ordena", () => {
    for (const entrada of [base, { ...base, lucroLtm: -1 }, { ...base, ehFinanceira: true }]) {
      const r = carryVigente().calcular(entrada);
      const texto = [r.explicacao, ...r.fatores.map((f) => f.texto)].join(" ").toLowerCase();
      // "garantido" só pode existir NEGADO (o aviso obrigatório)
      const semNegacao = texto.replaceAll("nunca retorno garantido", "");
      expect(semNegacao).not.toMatch(/garantid|prometid|compre|venda|recomend/);
    }
  });

  it("explicação da estimativa sempre presente e sempre com o aviso", () => {
    const r = carryVigente().calcular(base);
    expect(r.explicacao.length).toBeGreaterThan(30);
    expect(r.explicacao.toLowerCase()).toContain("estimativa");
    expect(r.explicacao.toLowerCase()).toContain("nunca retorno garantido");
  });

  it("é determinístico: mesma entrada, mesmo resultado", () => {
    const a = carryVigente().calcular(base);
    const b = carryVigente().calcular(base);
    expect(a).toEqual(b);
  });
});
