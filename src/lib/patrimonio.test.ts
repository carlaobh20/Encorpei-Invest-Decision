import { describe, expect, it } from "vitest";
import { calcularDrawdown, calcularSeriePatrimonio, indiceAcumulado } from "./patrimonio";

describe("indiceAcumulado", () => {
  it("taxa_diaria (CDI): compõe a cada observação, base 1.0 na primeira", () => {
    const obs = [
      { data: "2026-01-01", valor: 0.05 },
      { data: "2026-01-02", valor: 0.05 },
      { data: "2026-01-03", valor: 0.05 },
    ];
    const idx = indiceAcumulado(obs, "taxa_diaria", ["2026-01-01", "2026-01-02", "2026-01-03"]);
    expect(idx.get("2026-01-01")).toBeCloseTo(1, 6); // base
    expect(idx.get("2026-01-03")).toBeCloseTo(1.0005 ** 2, 6); // compõe 2x depois da base
  });

  it("nivel (Ibovespa): índice(t) = pontos(t) / pontos(primeira data)", () => {
    const obs = [
      { data: "2026-01-01", valor: 100000 },
      { data: "2026-01-02", valor: 110000 },
    ];
    const idx = indiceAcumulado(obs, "nivel", ["2026-01-01", "2026-01-02"]);
    expect(idx.get("2026-01-01")).toBeCloseTo(1, 6);
    expect(idx.get("2026-01-02")).toBeCloseTo(1.1, 6);
  });

  it("dia sem observação repete o último índice conhecido (não inventa)", () => {
    const obs = [{ data: "2026-01-01", valor: 100 }];
    const idx = indiceAcumulado(obs, "nivel", ["2026-01-01", "2026-01-02"]);
    expect(idx.get("2026-01-02")).toBe(idx.get("2026-01-01"));
  });
});

describe("calcularDrawdown", () => {
  it("sem queda: drawdown zero", () => {
    expect(calcularDrawdown([100, 110, 120])).toBe(0);
  });

  it("pico depois vale: calcula a queda percentual correta", () => {
    // pico 120, vale 90 → -25%
    expect(calcularDrawdown([100, 120, 90, 100])).toBeCloseTo(-0.25, 6);
  });

  it("série vazia: null", () => {
    expect(calcularDrawdown([])).toBeNull();
  });
});

describe("calcularSeriePatrimonio", () => {
  const datasPregao = ["2026-01-01", "2026-01-02", "2026-01-03"];

  it("posição única: valorCarteira segue o preço, benchmarks simulados a partir do valor investido", () => {
    const resultado = calcularSeriePatrimonio({
      posicoes: [{ ticker: "WEGE3", quantidade: 10, precoMedio: 10, dataCompra: "2026-01-01" }],
      precosPorTicker: new Map([
        [
          "WEGE3",
          [
            { data: "2026-01-01", fechamento: 10 },
            { data: "2026-01-02", fechamento: 11 },
            { data: "2026-01-03", fechamento: 12 },
          ],
        ],
      ]),
      cdi: [
        { data: "2026-01-01", valor: 0.05 },
        { data: "2026-01-02", valor: 0.05 },
        { data: "2026-01-03", valor: 0.05 },
      ],
      ipca: [{ data: "2026-01-01", valor: 0.4 }],
      ibovespa: [
        { data: "2026-01-01", valor: 100000 },
        { data: "2026-01-02", valor: 101000 },
        { data: "2026-01-03", valor: 99000 },
      ],
      datasPregao,
    });

    expect(resultado.pontos).toHaveLength(3);
    expect(resultado.pontos[0].valorCarteira).toBe(100); // 10 x R$10
    expect(resultado.pontos[2].valorCarteira).toBe(120); // 10 x R$12
    expect(resultado.rentabilidadeTotal).toBeCloseTo(0.2, 6); // 120/100 - 1

    // benchmark simulado no mesmo dia de entrada = o próprio valor investido
    expect(resultado.pontos[0].cdiSimulado).toBeCloseTo(100, 6);
    expect(resultado.pontos[0].ibovespaSimulado).toBeCloseTo(100, 6);

    // carteira rendeu 20% em 3 dias — deve bater o CDI e o Ibovespa nesse cenário
    expect(resultado.alpha.vsCdi).not.toBeNull();
    expect(resultado.alpha.vsCdi!).toBeGreaterThan(0);
  });

  it("posição sem data_compra nunca entra na série (nunca estima data)", () => {
    // Tipagem já exige dataCompra — este teste documenta a regra do módulo
    // que monta PosicaoDatada[] a partir de posições cruas (patrimonio-dados.ts):
    // ela deve FILTRAR fora quem não tem data, nunca inventar uma.
    const resultado = calcularSeriePatrimonio({
      posicoes: [],
      precosPorTicker: new Map(),
      cdi: [],
      ipca: [],
      ibovespa: [],
      datasPregao,
    });
    expect(resultado.pontos).toHaveLength(0);
    expect(resultado.motivoSemSharpe).toMatch(/Sem posições/);
  });

  it("múltiplos aportes em datas diferentes: Sharpe fica indisponível, com motivo explicado", () => {
    const resultado = calcularSeriePatrimonio({
      posicoes: [
        { ticker: "WEGE3", quantidade: 10, precoMedio: 10, dataCompra: "2026-01-01" },
        { ticker: "PETR4", quantidade: 10, precoMedio: 30, dataCompra: "2026-01-02" },
      ],
      precosPorTicker: new Map([
        ["WEGE3", datasPregao.map((d) => ({ data: d, fechamento: 10 }))],
        ["PETR4", datasPregao.map((d) => ({ data: d, fechamento: 30 }))],
      ]),
      cdi: datasPregao.map((d) => ({ data: d, valor: 0.05 })),
      ipca: [{ data: "2026-01-01", valor: 0.4 }],
      ibovespa: datasPregao.map((d) => ({ data: d, valor: 100000 })),
      datasPregao,
    });
    expect(resultado.sharpe).toBeNull();
    expect(resultado.motivoSemSharpe).toMatch(/aportes em datas diferentes/);
  });
});
