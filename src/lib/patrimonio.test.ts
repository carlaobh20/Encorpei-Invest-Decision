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

  it("taxa_evento (IPCA): 1º dia da janela sem publicação nasce em 1.0 (não fica null) — caso real: IPCA só publica dia 1 do mês, janela começa dia 5", () => {
    const obs = [
      { data: "2026-04-01", valor: 0.67 }, // antes da janela — não deve importar
      { data: "2026-06-01", valor: 0.16 }, // só entra dentro da janela no 6º dia
    ];
    const janela = ["2026-05-05", "2026-05-06", "2026-05-07", "2026-05-08", "2026-05-09", "2026-06-01"];
    const idx = indiceAcumulado(obs, "taxa_evento", janela);
    expect(idx.get("2026-05-05")).toBeCloseTo(1, 6); // nasce em 1.0, não null
    expect(idx.get("2026-05-09")).toBeCloseTo(1, 6); // sem publicação nova: repete
    expect(idx.get("2026-06-01")).toBeCloseTo(1.0016, 6); // publicação de junho compõe a partir do 1.0
  });

  it("taxa_diaria (CDI): 1º dia da janela sem publicação (fim de semana) também nasce em 1.0", () => {
    const obs = [{ data: "2026-01-02", valor: 0.05 }]; // 1º dia útil é 02/01, não 01/01
    const idx = indiceAcumulado(obs, "taxa_diaria", ["2026-01-01", "2026-01-02"]);
    expect(idx.get("2026-01-01")).toBeCloseTo(1, 6);
    expect(idx.get("2026-01-02")).toBeCloseTo(1.0005, 6);
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

  it("dataCompra anterior ao início do histórico de preço: benchmark simulado ainda funciona (bug real de 03/08/2026 — Carlos reportou CDI/Ibovespa sumidos do gráfico)", () => {
    // Reproduz o caso real: posição comprada em 2025-12-10, mas o backfill de
    // preços das ações só começa em 2026-05-05 (datasPregao = janela do
    // gráfico). Antes da correção, o índice do benchmark só existia nas
    // datas de datasPregao — buscar pelo índice EXATAMENTE em "2025-12-10"
    // nunca batia, e cdiSimulado/ipcaSimulado/ibovespaSimulado ficavam null
    // em TODO ponto, mesmo com CDI/IPCA/Ibovespa cobrindo o período inteiro.
    const datasPregao = ["2026-05-05", "2026-05-06", "2026-05-07"];
    const resultado = calcularSeriePatrimonio({
      posicoes: [
        { ticker: "VALE3", quantidade: 100, precoMedio: 60, dataCompra: "2025-12-10" },
      ],
      precosPorTicker: new Map([
        ["VALE3", datasPregao.map((d, i) => ({ data: d, fechamento: 60 * (1 + i * 0.01) }))],
      ]),
      // CDI/IPCA/Ibovespa cobrem BEM antes da dataCompra — a fonte de dado
      // não é o problema, o problema era a chave de busca do índice.
      cdi: [
        { data: "2025-12-01", valor: 0.05 },
        { data: "2026-05-05", valor: 0.05 },
        { data: "2026-05-06", valor: 0.05 },
        { data: "2026-05-07", valor: 0.05 },
      ],
      // IPCA é mensal (taxa_evento): precisa de uma observação DENTRO da
      // janela pra compor — uma publicação só em 2025-12-01 (fora da janela
      // de 3 pregões em maio) deixaria o IPCA honestamente indisponível
      // aqui, o que não é o que este teste quer verificar (esse é um caso
      // à parte, não o bug da dataCompra).
      ipca: [
        { data: "2025-12-01", valor: 0.4 },
        { data: "2026-05-05", valor: 0.35 },
      ],
      ibovespa: [
        { data: "2025-12-01", valor: 100000 },
        { data: "2026-05-05", valor: 130000 },
        { data: "2026-05-06", valor: 131000 },
        { data: "2026-05-07", valor: 132000 },
      ],
      datasPregao,
    });
    const ultimo = resultado.pontos[resultado.pontos.length - 1];
    expect(ultimo.cdiSimulado).not.toBeNull();
    expect(ultimo.ipcaSimulado).not.toBeNull();
    expect(ultimo.ibovespaSimulado).not.toBeNull();
    expect(resultado.alpha.vsCdi).not.toBeNull();
    expect(resultado.alpha.vsIbovespa).not.toBeNull();
    // a simulação ancora no primeiro pregão da janela (2026-05-05), não na
    // dataCompra registrada — Ibovespa foi de 130000 a 132000 nesse trecho
    // (+1,538%), então R$6.000 investidos viram ~R$6.092,31
    expect(ultimo.ibovespaSimulado!).toBeCloseTo(6000 * (132000 / 130000), 2);
  });
});
