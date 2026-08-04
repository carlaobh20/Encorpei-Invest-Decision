import { describe, expect, it } from "vitest";
import { detectarErroClassicoRelacionado, BIBLIOTECA_ERROS_CLASSICOS } from "./erros-classicos";

describe("BIBLIOTECA_ERROS_CLASSICOS", () => {
  it("tem os 5 erros da spec, cada um com id único", () => {
    expect(BIBLIOTECA_ERROS_CLASSICOS).toHaveLength(5);
    const ids = BIBLIOTECA_ERROS_CLASSICOS.map((e) => e.id);
    expect(new Set(ids).size).toBe(5);
  });
});

describe("detectarErroClassicoRelacionado", () => {
  it("sem nenhum sinal relevante, não detecta nada", () => {
    expect(detectarErroClassicoRelacionado({ quality: 50, growth: 50, technical: 50, earningsYield: 0.08 })).toBeNull();
  });

  it("technical alto + quality baixa vira 'olhar apenas análise técnica'", () => {
    const r = detectarErroClassicoRelacionado({ quality: 30, growth: null, technical: 80, earningsYield: null });
    expect(r?.erro.id).toBe("so_tecnica");
  });

  it("growth alto + quality baixa vira 'confundir crescimento com qualidade'", () => {
    const r = detectarErroClassicoRelacionado({ quality: 35, growth: 75, technical: null, earningsYield: null });
    expect(r?.erro.id).toBe("crescimento_sem_qualidade");
  });

  it("quality alta + earnings yield baixo (caro) vira 'comprar empresa boa em preço ruim'", () => {
    const r = detectarErroClassicoRelacionado({ quality: 80, growth: null, technical: null, earningsYield: 0.03 });
    expect(r?.erro.id).toBe("comprar_caro");
  });

  it("earnings yield muito alto (barato) + quality baixa vira 'olhar apenas P/L'", () => {
    const r = detectarErroClassicoRelacionado({ quality: 20, growth: null, technical: null, earningsYield: 0.15 });
    expect(r?.erro.id).toBe("so_pl");
  });

  it("nenhum campo tem matcher pra 'olhar apenas dividend yield' — sempre null mesmo com todos os sinais extremos", () => {
    // não existe earningsYield/quality/growth/technical combo que produza esse id — confirma que ele é só biblioteca, não matcher
    const algumBate = [
      { quality: 90, growth: 90, technical: 90, earningsYield: 0.2 },
      { quality: 10, growth: 10, technical: 10, earningsYield: 0.01 },
    ].some((s) => detectarErroClassicoRelacionado(s)?.erro.id === "so_dividend_yield");
    expect(algumBate).toBe(false);
  });

  it("prioridade: technical alto + quality baixa E growth alto + quality baixa ao mesmo tempo → técnica vence (checada primeiro)", () => {
    const r = detectarErroClassicoRelacionado({ quality: 20, growth: 80, technical: 80, earningsYield: null });
    expect(r?.erro.id).toBe("so_tecnica");
  });

  it("valores null em tudo não quebra e devolve null", () => {
    expect(detectarErroClassicoRelacionado({ quality: null, growth: null, technical: null, earningsYield: null })).toBeNull();
  });
});
