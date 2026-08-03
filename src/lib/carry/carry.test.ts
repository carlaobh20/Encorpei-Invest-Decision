import { describe, expect, it } from "vitest";
import { carryVigente } from "./index";
import { carryV2Growth } from "./v2-growth";
import { escadaCarry } from "./escada";
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

describe("Carry v2 (Growth)", () => {
  const comDfc: CarryEntrada = {
    ...base,
    dividendosJcpLtm: -180_000_000, // DFC traz pagamento como negativo
    caixaOperacionalLtm: 800_000_000,
    capexLtm: -200_000_000,
  };

  it("fórmula: yield×payout + retenção×ROIC", () => {
    // floor 6% · payout 30% · retenção 70% · roic 20%
    // = 0.06*0.3 + 0.7*0.2 = 0.018 + 0.14 = 0.158
    const r = carryV2Growth.calcular(comDfc);
    expect(r.carryReal).toBeCloseTo(0.158, 3);
    expect(r.versao).toBe(2);
  });

  it("sem dividendos da DFC: null com pendência explícita — nunca chuta payout", () => {
    const r = carryV2Growth.calcular(base);
    expect(r.carryReal).toBeNull();
    expect(r.explicacao).toContain("aguarda");
  });

  it("ROIC baixo faz Growth ficar ABAIXO do Floor (verdade dura preservada)", () => {
    const r = carryV2Growth.calcular({ ...comDfc, roic4: 0.02 }); // reter destrói
    // 0.06*0.3 + 0.7*0.02 = 0.018 + 0.014 = 0.032 < floor 0.06
    expect(r.carryReal).toBeLessThan(0.06);
  });

  it("payout acima de 100% é limitado (não inventa retenção negativa)", () => {
    const r = carryV2Growth.calcular({ ...comDfc, dividendosJcpLtm: -900_000_000 });
    expect(r.carryReal).toBeCloseTo(0.06, 3); // payout 100% → só o yield
  });

  it("trava de linguagem também no v2", () => {
    for (const e of [comDfc, base]) {
      const r = carryV2Growth.calcular(e);
      const texto = [r.explicacao, ...r.fatores.map((f: { texto: string }) => f.texto)]
        .join(" ").toLowerCase().replaceAll("nunca retorno garantido", "");
      expect(texto).not.toMatch(/garantid|prometid|compre|venda|recomend/);
    }
  });
});

describe("escadaCarry", () => {
  it("5 níveis sempre presentes; sem DFC só o Floor tem número", () => {
    const degraus = escadaCarry(base);
    expect(degraus).toHaveLength(5);
    expect(degraus[0].resultado?.carryReal).toBeCloseTo(0.06, 3);
    expect(degraus[1].pendencia).toContain("DFC");
    expect(degraus[4].pendencia).toContain("indicador principal");
  });
});
