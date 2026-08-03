import { describe, expect, it } from "vitest";
import { consolidarCarteira, notaPonderada, type Posicao } from "./carteira";

/**
 * CARTEIRA — a consolidação nunca inventa número: sem preço de UMA posição,
 * o total fica null (e não um total "quase certo" que mente por omissão).
 */

const posicoes: Posicao[] = [
  { ticker: "WEGE3", quantidade: 100, preco_medio: 40 },   // investido 4.000
  { ticker: "ITUB4", quantidade: 200, preco_medio: 30 },   // investido 6.000
];

describe("consolidarCarteira", () => {
  it("com todos os preços: valores, resultado e pesos fecham", () => {
    const precos = new Map([
      ["WEGE3", 50], // atual 5.000 (+25%)
      ["ITUB4", 25], // atual 5.000 (−16,7%)
    ]);
    const c = consolidarCarteira(posicoes, precos);

    expect(c.valorInvestido).toBe(10_000);
    expect(c.valorAtual).toBe(10_000);
    expect(c.resultado).toBe(0);
    expect(c.resultadoPct).toBe(0);

    const wege = c.linhas.find((l) => l.ticker === "WEGE3")!;
    expect(wege.resultado).toBe(1_000);
    expect(wege.resultadoPct).toBeCloseTo(0.25);
    expect(wege.peso).toBeCloseTo(0.5);

    // pesos somam 1
    const somaPesos = c.linhas.reduce((a, l) => a + (l.peso ?? 0), 0);
    expect(somaPesos).toBeCloseTo(1);
  });

  it("faltando preço de UMA posição: total atual/resultado/pesos ficam null", () => {
    const precos = new Map([["WEGE3", 50]]); // ITUB4 sem preço
    const c = consolidarCarteira(posicoes, precos);

    expect(c.valorInvestido).toBe(10_000); // investido não depende de preço
    expect(c.valorAtual).toBeNull();
    expect(c.resultado).toBeNull();
    expect(c.resultadoPct).toBeNull();
    expect(c.alocacaoPorModelo).toEqual([]);
    for (const l of c.linhas) expect(l.peso).toBeNull();
  });

  it("alocação por modelo agrega pelo rótulo e soma 1", () => {
    const precos = new Map([
      ["WEGE3", 50],
      ["ITUB4", 25],
    ]);
    const c = consolidarCarteira(posicoes, precos);
    const soma = c.alocacaoPorModelo.reduce((a, m) => a + m.pct, 0);
    expect(soma).toBeCloseTo(1);
    // WEGE3=industrial, ITUB4=banco → dois grupos distintos
    expect(c.alocacaoPorModelo.length).toBe(2);
  });

  it("carteira vazia: zeros e nulls, nunca NaN", () => {
    const c = consolidarCarteira([], new Map());
    expect(c.valorInvestido).toBe(0);
    expect(c.valorAtual).toBe(0);
    expect(c.resultadoPct).toBeNull(); // 0/0 não vira número
    expect(c.linhas).toEqual([]);
  });
});

describe("notaPonderada", () => {
  const precos = new Map([
    ["WEGE3", 50],
    ["ITUB4", 25],
  ]);

  it("pondera pelo peso quando todas as notas existem", () => {
    const c = consolidarCarteira(posicoes, precos);
    const notas = new Map([
      ["WEGE3", 90],
      ["ITUB4", 70],
    ]);
    // pesos 50/50 → média 80
    expect(notaPonderada(c.linhas, notas)).toBeCloseTo(80);
  });

  it("falta a nota de UMA linha → null (nunca média parcial)", () => {
    const c = consolidarCarteira(posicoes, precos);
    const notas = new Map([["WEGE3", 90]]);
    expect(notaPonderada(c.linhas, notas)).toBeNull();
  });

  it("sem pesos (preço faltando) → null", () => {
    const c = consolidarCarteira(posicoes, new Map([["WEGE3", 50]]));
    const notas = new Map([
      ["WEGE3", 90],
      ["ITUB4", 70],
    ]);
    expect(notaPonderada(c.linhas, notas)).toBeNull();
  });

  it("carteira vazia → null", () => {
    expect(notaPonderada([], new Map())).toBeNull();
  });
});
