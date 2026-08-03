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
    // mesmo gate honesto cobre Sortino e Volatilidade — nunca um mais frouxo
    expect(resultado.sortino).toBeNull();
    expect(resultado.volatilidadeAnualizada).toBeNull();
  });

  it("menos de 20 pregões: Sortino e Volatilidade também ficam indisponíveis (mesmo gate do Sharpe)", () => {
    const resultado = calcularSeriePatrimonio({
      posicoes: [{ ticker: "WEGE3", quantidade: 10, precoMedio: 10, dataCompra: "2026-01-01" }],
      precosPorTicker: new Map([
        ["WEGE3", datasPregao.map((d) => ({ data: d, fechamento: 10 }))],
      ]),
      cdi: datasPregao.map((d) => ({ data: d, valor: 0.05 })),
      ipca: [{ data: "2026-01-01", valor: 0.4 }],
      ibovespa: datasPregao.map((d) => ({ data: d, valor: 100000 })),
      datasPregao,
    });
    expect(resultado.sharpe).toBeNull();
    expect(resultado.sortino).toBeNull();
    expect(resultado.volatilidadeAnualizada).toBeNull();
    expect(resultado.motivoSemSharpe).toMatch(/menos de 20 pregões/);
  });

  it("aporte único, 25 pregões, carteira crescendo taxa ~constante e CDI plano: volatilidade ~0 e Sortino null (sem dias de downside)", () => {
    const n = 25;
    const datas = Array.from({ length: n }, (_, i) => `2026-01-${String(i + 1).padStart(2, "0")}`);
    // crescimento composto constante de 1% ao dia — retornos praticamente
    // idênticos todo dia, então desvio (e a "penalidade" de downside) ~0.
    const precos = datas.map((d, i) => ({ data: d, fechamento: 100 * 1.01 ** i }));
    const resultado = calcularSeriePatrimonio({
      posicoes: [{ ticker: "WEGE3", quantidade: 1, precoMedio: 100, dataCompra: datas[0] }],
      precosPorTicker: new Map([["WEGE3", precos]]),
      cdi: datas.map((d) => ({ data: d, valor: 0 })), // CDI plano — excesso = retorno da carteira
      ipca: [{ data: datas[0], valor: 0.4 }],
      ibovespa: datas.map((d) => ({ data: d, valor: 100000 })),
      datasPregao: datas,
    });
    expect(resultado.motivoSemSharpe).toBeNull();
    expect(resultado.volatilidadeAnualizada).not.toBeNull();
    expect(resultado.volatilidadeAnualizada!).toBeCloseTo(0, 3);
    // sem nenhum dia de retorno abaixo do CDI, downside deviation = 0 → Sortino indefinido (não infinito)
    expect(resultado.sortino).toBeNull();
  });

  it("aporte único, 25 pregões, carteira com dias de queda: Sortino calculado só com o desvio abaixo do CDI", () => {
    const n = 25;
    const datas = Array.from({ length: n }, (_, i) => `2026-02-${String(i + 1).padStart(2, "0")}`);
    // zig-zag: sobe 3%, cai 1%, alternado — mistura de dias acima/abaixo do CDI (0%)
    let preco = 100;
    const precos = datas.map((d, i) => {
      if (i > 0) preco *= i % 2 === 1 ? 1.03 : 0.99;
      return { data: d, fechamento: preco };
    });
    const resultado = calcularSeriePatrimonio({
      posicoes: [{ ticker: "WEGE3", quantidade: 1, precoMedio: 100, dataCompra: datas[0] }],
      precosPorTicker: new Map([["WEGE3", precos]]),
      cdi: datas.map((d) => ({ data: d, valor: 0 })),
      ipca: [{ data: datas[0], valor: 0.4 }],
      ibovespa: datas.map((d) => ({ data: d, valor: 100000 })),
      datasPregao: datas,
    });
    expect(resultado.motivoSemSharpe).toBeNull();
    expect(resultado.sharpe).not.toBeNull();
    expect(resultado.sortino).not.toBeNull();
    expect(resultado.volatilidadeAnualizada).not.toBeNull();
    expect(resultado.volatilidadeAnualizada!).toBeGreaterThan(0);
    // Sortino só penaliza o downside — deve ser maior que o Sharpe (que penaliza toda a variância)
    expect(resultado.sortino!).toBeGreaterThan(resultado.sharpe!);
  });
});
