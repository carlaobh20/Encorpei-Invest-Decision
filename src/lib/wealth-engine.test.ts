import { describe, expect, it } from "vitest";
import { calcularWealthEngine, MIN_PREGOES_CAGR, simularMeta } from "./wealth-engine";
import type { ResultadoPatrimonio, PontoPatrimonio } from "./patrimonio";

function pontos(n: number, diasEntrePontos: number, valorCarteiraFinal = 100): PontoPatrimonio[] {
  const inicio = new Date("2022-01-01T00:00:00Z").getTime();
  const umDiaMs = 24 * 60 * 60 * 1000;
  return Array.from({ length: n }, (_, i) => {
    const data = new Date(inicio + i * diasEntrePontos * umDiaMs).toISOString().slice(0, 10);
    return {
      data,
      valorCarteira: i === n - 1 ? valorCarteiraFinal : 50 + i,
      valorInvestidoAcumulado: 50,
      cdiSimulado: null,
      ipcaSimulado: null,
      ibovespaSimulado: null,
    };
  });
}

function patrimonioBase(over: Partial<ResultadoPatrimonio> = {}): ResultadoPatrimonio {
  return {
    pontos: [],
    posicoesForaDaSerie: [],
    drawdownMaximo: null,
    sharpe: null,
    volatilidadeAnualizada: null,
    sortino: null,
    motivoSemSharpe: null,
    rentabilidadeTotal: null,
    alpha: { vsCdi: null, vsIpca: null, vsIbovespa: null },
    ...over,
  };
}

describe("calcularWealthEngine", () => {
  it("série curta demais (menos que o mínimo de pregões): CAGR null com motivo", () => {
    const patrimonio = patrimonioBase({ pontos: pontos(MIN_PREGOES_CAGR - 5, 5), rentabilidadeTotal: 0.1 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: null });
    expect(r.cagr).toBeNull();
    expect(r.motivoSemCagr).not.toBeNull();
  });

  it("rentabilidadeTotal indisponível: CAGR null com motivo, mesmo com série longa", () => {
    const patrimonio = patrimonioBase({ pontos: pontos(MIN_PREGOES_CAGR + 10, 5), rentabilidadeTotal: null });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: null });
    expect(r.cagr).toBeNull();
    expect(r.motivoSemCagr).toContain("Rentabilidade total");
  });

  it("anualiza corretamente a rentabilidade total pelo prazo real da série", () => {
    // ~2 anos de janela (730 dias), rentabilidade total de 100% no período → CAGR ~= sqrt(2)-1
    const serie = pontos(MIN_PREGOES_CAGR, 730 / (MIN_PREGOES_CAGR - 1));
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: 1.0 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: null });
    expect(r.cagr).not.toBeNull();
    expect(r.cagr!).toBeCloseTo(Math.sqrt(2) - 1, 2);
    expect(r.motivoSemCagr).toBeNull();
  });

  it("espelha alpha.vsIpca sem recalcular, e anualiza quando disponível", () => {
    const serie = pontos(MIN_PREGOES_CAGR, 730 / (MIN_PREGOES_CAGR - 1));
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: 0.5, alpha: { vsCdi: null, vsIpca: 0.2, vsIbovespa: null } });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: null });
    expect(r.retornoRealAcimaInflacao).toBe(0.2);
    expect(r.cagrRealAcimaInflacao).not.toBeNull();
  });

  it("alpha.vsIpca null: cagrRealAcimaInflacao fica null com aviso, nunca inventa número", () => {
    const serie = pontos(MIN_PREGOES_CAGR, 730 / (MIN_PREGOES_CAGR - 1));
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: 0.5 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: null });
    expect(r.cagrRealAcimaInflacao).toBeNull();
    expect(r.avisos.some((a) => a.includes("alpha.vsIpca"))).toBe(true);
  });

  it("probabilidadeAtingirObjetivo é sempre null — nunca fabrica uma projeção estatística", () => {
    const serie = pontos(MIN_PREGOES_CAGR, 730 / (MIN_PREGOES_CAGR - 1));
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: 0.5 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: 1_000_000 });
    expect(r.probabilidadeAtingirObjetivo).toBeNull();
    expect(r.motivoSemProbabilidade.length).toBeGreaterThan(10);
  });

  it("objetivo informado mas sem CAGR calculável (série curta): tempo estimado null com aviso específico", () => {
    const patrimonio = patrimonioBase({ pontos: pontos(MIN_PREGOES_CAGR - 5, 5), rentabilidadeTotal: 0.1 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: 1_000_000 });
    expect(r.cagr).toBeNull();
    expect(r.tempoEstimadoAnos).toBeNull();
    expect(r.avisos.some((a) => a.includes("Sem CAGR histórico calculável"))).toBe(true);
  });

  it("patrimônio atual não positivo (série zerada): tempo estimado não projetado, com aviso", () => {
    const serie = pontos(MIN_PREGOES_CAGR, 730 / (MIN_PREGOES_CAGR - 1), 0);
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: 0.5 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: 1_000_000 });
    expect(r.cagr).not.toBeNull();
    expect(r.tempoEstimadoAnos).toBeNull();
    expect(r.avisos.some((a) => a.includes("Patrimônio atual indisponível ou não positivo"))).toBe(true);
  });

  it("sem patrimônio objetivo: tempo estimado null com aviso", () => {
    const serie = pontos(MIN_PREGOES_CAGR, 730 / (MIN_PREGOES_CAGR - 1));
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: 0.5 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: null });
    expect(r.tempoEstimadoAnos).toBeNull();
    expect(r.avisos.some((a) => a.includes("objetivo informado"))).toBe(true);
  });

  it("objetivo já atingido pelo valor atual: tempo estimado zero, com aviso", () => {
    const serie = pontos(MIN_PREGOES_CAGR, 730 / (MIN_PREGOES_CAGR - 1), 200);
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: 1.0 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: 100 });
    expect(r.tempoEstimadoAnos).toBe(0);
    expect(r.avisos.some((a) => a.includes("já foi atingido"))).toBe(true);
  });

  it("projeta tempo estimado via juros compostos ao CAGR histórico", () => {
    const serie = pontos(MIN_PREGOES_CAGR, 365 / (MIN_PREGOES_CAGR - 1), 100); // ~1 ano, valorCarteira final = 100
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: 1.0 }); // 100% no ano → CAGR ~= 1.0
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: 400 });
    expect(r.cagr).not.toBeNull();
    expect(r.tempoEstimadoAnos).not.toBeNull();
    const esperado = Math.log(400 / 100) / Math.log(1 + r.cagr!);
    expect(r.tempoEstimadoAnos!).toBeCloseTo(esperado, 6);
  });

  it("CAGR não positivo: tempo estimado não calculado, com aviso", () => {
    const serie = pontos(MIN_PREGOES_CAGR, 730 / (MIN_PREGOES_CAGR - 1), 100);
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: -0.3 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: 400 });
    expect(r.cagr).not.toBeNull();
    expect(r.cagr!).toBeLessThan(0);
    expect(r.tempoEstimadoAnos).toBeNull();
    expect(r.avisos.some((a) => a.includes("não positivo"))).toBe(true);
  });

  it("nunca usa linguagem de recomendação", () => {
    const serie = pontos(MIN_PREGOES_CAGR, 730 / (MIN_PREGOES_CAGR - 1));
    const patrimonio = patrimonioBase({ pontos: serie, rentabilidadeTotal: 0.5 });
    const r = calcularWealthEngine({ patrimonio, patrimonioObjetivo: 1_000_000 });
    const texto = [...r.premissas, r.motivoSemProbabilidade, ...r.avisos].join(" ").toLowerCase();
    expect(texto).not.toMatch(/\bcompre\b|\bvenda\b|recomend/);
  });
});

describe("simularMeta", () => {
  it("sem CAGR real informado: projeção indisponível, com motivo — nunca assume um CAGR arbitrário", () => {
    const r = simularMeta({
      patrimonioAtual: 100_000,
      metaPatrimonial: 1_000_000,
      prazoAnos: 10,
      aporteMensalReal: 1_000,
      cagrRealAA: null,
      inflacaoEspAA: null,
    });
    expect(r.patrimonioProjetado).toBeNull();
    expect(r.motivoIndisponivel).not.toBeNull();
  });

  it("prazo zero ou negativo: indisponível com motivo", () => {
    const r = simularMeta({
      patrimonioAtual: 100_000,
      metaPatrimonial: 1_000_000,
      prazoAnos: 0,
      aporteMensalReal: 1_000,
      cagrRealAA: 0.08,
      inflacaoEspAA: null,
    });
    expect(r.patrimonioProjetado).toBeNull();
    expect(r.motivoIndisponivel).toContain("Prazo");
  });

  it("sem aporte e CAGR zero: projeção = patrimônio atual (juros compostos degenerado)", () => {
    const r = simularMeta({
      patrimonioAtual: 100_000,
      metaPatrimonial: 1_000_000,
      prazoAnos: 10,
      aporteMensalReal: 0,
      cagrRealAA: 0,
      inflacaoEspAA: null,
    });
    expect(r.patrimonioProjetado).toBeCloseTo(100_000, 2);
  });

  it("com aporte mensal constante e CAGR zero: projeção = patrimônio atual + soma dos aportes", () => {
    const r = simularMeta({
      patrimonioAtual: 100_000,
      metaPatrimonial: 1_000_000,
      prazoAnos: 5,
      aporteMensalReal: 1_000,
      cagrRealAA: 0,
      inflacaoEspAA: null,
    });
    expect(r.patrimonioProjetado).toBeCloseTo(100_000 + 1_000 * 60, 2);
  });

  it("gap positivo quando a projeção fica aquém da meta", () => {
    const r = simularMeta({
      patrimonioAtual: 10_000,
      metaPatrimonial: 1_000_000,
      prazoAnos: 5,
      aporteMensalReal: 100,
      cagrRealAA: 0.05,
      inflacaoEspAA: null,
    });
    expect(r.gap).not.toBeNull();
    expect(r.gap!).toBeGreaterThan(0);
  });

  it("gap negativo (ou zero) quando a projeção já bate a meta", () => {
    const r = simularMeta({
      patrimonioAtual: 950_000,
      metaPatrimonial: 1_000_000,
      prazoAnos: 5,
      aporteMensalReal: 5_000,
      cagrRealAA: 0.08,
      inflacaoEspAA: null,
    });
    expect(r.gap!).toBeLessThanOrEqual(0);
  });

  it("cagrNecessarioAA: aplicado de volta na mesma projeção, bate a meta dentro do prazo (verificação por bisseção inversa)", () => {
    const r = simularMeta({
      patrimonioAtual: 100_000,
      metaPatrimonial: 500_000,
      prazoAnos: 10,
      aporteMensalReal: 500,
      cagrRealAA: 0.03, // CAGR "atual" baixo demais de propósito, pra forçar cagrNecessario > cagrRealAA
      inflacaoEspAA: null,
    });
    expect(r.cagrNecessarioAA).not.toBeNull();
    const verificacao = simularMeta({
      patrimonioAtual: 100_000,
      metaPatrimonial: 500_000,
      prazoAnos: 10,
      aporteMensalReal: 500,
      cagrRealAA: r.cagrNecessarioAA,
      inflacaoEspAA: null,
    });
    expect(verificacao.patrimonioProjetado!).toBeCloseTo(500_000, 0);
  });

  it("meta inatingível mesmo a 100% a.a. real: cagrNecessarioAA null, nunca um número fabricado", () => {
    const r = simularMeta({
      patrimonioAtual: 100,
      metaPatrimonial: 100_000_000,
      prazoAnos: 1,
      aporteMensalReal: 0,
      cagrRealAA: 0.08,
      inflacaoEspAA: null,
    });
    expect(r.cagrNecessarioAA).toBeNull();
  });

  it("metaNominalEstimada só aparece quando inflacaoEspAA é informada, nunca fabricada por padrão", () => {
    const semInflacao = simularMeta({
      patrimonioAtual: 100_000,
      metaPatrimonial: 1_000_000,
      prazoAnos: 10,
      aporteMensalReal: 1_000,
      cagrRealAA: 0.05,
      inflacaoEspAA: null,
    });
    expect(semInflacao.metaNominalEstimada).toBeNull();

    const comInflacao = simularMeta({
      patrimonioAtual: 100_000,
      metaPatrimonial: 1_000_000,
      prazoAnos: 10,
      aporteMensalReal: 1_000,
      cagrRealAA: 0.05,
      inflacaoEspAA: 0.04,
    });
    expect(comInflacao.metaNominalEstimada).toBeCloseTo(1_000_000 * Math.pow(1.04, 10), 2);
  });

  it("aviso de projeção nunca vira linguagem de probabilidade nem de recomendação", () => {
    const r = simularMeta({
      patrimonioAtual: 100_000,
      metaPatrimonial: 1_000_000,
      prazoAnos: 10,
      aporteMensalReal: 1_000,
      cagrRealAA: 0.05,
      inflacaoEspAA: null,
    });
    expect(r.avisoProjecao.toLowerCase()).not.toMatch(/probabilidade estatística de|\bcompre\b|\bvenda\b/);
    expect(r.avisoProjecao.toLowerCase()).toContain("projeção determinística");
  });
});
