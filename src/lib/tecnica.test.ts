import { describe, expect, it } from "vitest";
import { lerMomento, rsi14 } from "./tecnica";

/** Leitura técnica — honestidade com dado de menos e valores clássicos. */

describe("rsi14", () => {
  it("com menos de 15 fechamentos devolve null", () => {
    expect(rsi14(Array.from({ length: 14 }, (_, i) => 10 + i))).toBeNull();
  });

  it("alta contínua leva o RSI ao teto (100)", () => {
    const serie = Array.from({ length: 30 }, (_, i) => 10 + i); // só sobe
    expect(rsi14(serie)).toBe(100);
  });

  it("queda contínua leva o RSI ao chão (~0)", () => {
    const serie = Array.from({ length: 30 }, (_, i) => 100 - i); // só cai
    expect(rsi14(serie)!).toBeLessThan(1);
  });

  it("série lateral fica na faixa neutra", () => {
    const serie = Array.from({ length: 40 }, (_, i) => 50 + (i % 2 === 0 ? 1 : -1));
    const v = rsi14(serie)!;
    expect(v).toBeGreaterThan(30);
    expect(v).toBeLessThan(70);
  });
});

describe("lerMomento", () => {
  it("com 1 pregão: nada pronto, 4 pendentes com contadores honestos", () => {
    const m = lerMomento([10]);
    expect(m.prontos).toHaveLength(0);
    expect(m.pendentes).toHaveLength(4);
    expect(m.pendentes[0]).toContain("temos 1");
  });

  it("com 65 pregões: os 4 indicadores acendem", () => {
    const serie = Array.from({ length: 65 }, (_, i) => 20 + Math.sin(i / 5) * 2);
    const m = lerMomento(serie);
    expect(m.prontos).toHaveLength(4);
    expect(m.pendentes).toHaveLength(0);
  });

  it("queda de 20% da máxima gera atenção positiva na distância da máxima", () => {
    const serie = [
      ...Array.from({ length: 40 }, () => 100),
      ...Array.from({ length: 25 }, () => 80), // 20% abaixo
    ];
    const m = lerMomento(serie);
    const dist = m.prontos.find((p) => p.indicador.startsWith("Distância"));
    expect(dist?.tom).toBe("atencao_positiva");
    expect(dist?.valor).toContain("20");
  });

  it("nenhuma leitura contém linguagem de ordem (compre/venda)", () => {
    const serie = Array.from({ length: 65 }, (_, i) => 20 + i * 0.1);
    const m = lerMomento(serie);
    for (const p of m.prontos) {
      const texto = `${p.indicador} ${p.leitura}`.toLowerCase();
      expect(texto).not.toMatch(/compr|vend|recomend/);
    }
  });
});
