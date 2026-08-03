import { describe, expect, it } from "vitest";
import {
  auditarEmpresa,
  checarCaixaNegativo,
  checarIndicadorSetorial,
  checarMargemRecalculada,
  checarMargens,
  checarValorMercado,
  resumoSeveridade,
} from "./auditoria";

describe("checarValorMercado", () => {
  it("ok quando cotação × ações bate com a fonte", () => {
    const v = checarValorMercado({ ticker: "WEGE3", cotacao: 50, qtdAcoes: 1_000_000, marketCapBruto: 50_000_000 });
    expect(v?.severidade).toBe("ok");
  });

  it("crítico quando diverge mais de 10%", () => {
    const v = checarValorMercado({ ticker: "WEGE3", cotacao: 50, qtdAcoes: 1_000_000, marketCapBruto: 40_000_000 });
    expect(v?.severidade).toBe("critico");
  });

  it("alerta quando diverge entre 2% e 10%", () => {
    const v = checarValorMercado({ ticker: "WEGE3", cotacao: 50, qtdAcoes: 1_000_000, marketCapBruto: 48_000_000 });
    expect(v?.severidade).toBe("alerta");
  });

  it("null (não roda) quando falta dado — nunca estima", () => {
    expect(checarValorMercado({ ticker: "WEGE3", cotacao: null, qtdAcoes: 1000, marketCapBruto: 5000 })).toBeNull();
  });
});

describe("checarMargens", () => {
  it("ok quando margem líquida ≤ margem bruta", () => {
    const v = checarMargens({ ticker: "WEGE3", margemBruta: 0.35, margemLiquida: 0.16 });
    expect(v?.severidade).toBe("ok");
  });

  it("crítico quando margem líquida > margem bruta (impossível)", () => {
    const v = checarMargens({ ticker: "WEGE3", margemBruta: 0.16, margemLiquida: 0.35 });
    expect(v?.severidade).toBe("critico");
  });
});

describe("checarMargemRecalculada", () => {
  it("ok quando lucro/receita bate com a margem reportada", () => {
    const v = checarMargemRecalculada({ ticker: "ABEV3", receita: 1000, lucro: 170, margemLiquida: 0.17 });
    expect(v?.severidade).toBe("ok");
  });

  it("crítico quando há erro de escala (ex.: percentual vs fração, como o caso INTB3)", () => {
    // margem reportada em "12" (percentual) em vez de 0.12 (fração) — erro clássico de parser
    const v = checarMargemRecalculada({ ticker: "INTB3", receita: 1000, lucro: 120, margemLiquida: 12 });
    expect(v?.severidade).toBe("critico");
  });
});

describe("checarIndicadorSetorial", () => {
  it("crítico quando ROIC aparece para um banco (indicador excluído do modelo)", () => {
    const v = checarIndicadorSetorial({ ticker: "ITUB4", indicador: "roic", rotuloIndicador: "ROIC", valor: 0.18 });
    expect(v?.severidade).toBe("critico");
  });

  it("ok quando ROIC aparece para uma industrial (indicador permitido)", () => {
    const v = checarIndicadorSetorial({ ticker: "WEGE3", indicador: "roic", rotuloIndicador: "ROIC", valor: 0.3 });
    expect(v?.severidade).toBe("ok");
  });

  it("null quando o ticker não tem modelo classificado", () => {
    expect(
      checarIndicadorSetorial({ ticker: "XXXX3", indicador: "roic", rotuloIndicador: "ROIC", valor: 0.1 })
    ).toBeNull();
  });
});

describe("checarCaixaNegativo", () => {
  it("crítico quando caixa é negativo", () => {
    const v = checarCaixaNegativo({ ticker: "WEGE3", caixa: -100 });
    expect(v?.severidade).toBe("critico");
  });

  it("ok quando caixa é positivo ou zero", () => {
    expect(checarCaixaNegativo({ ticker: "WEGE3", caixa: 0 })?.severidade).toBe("ok");
  });
});

describe("auditarEmpresa + resumoSeveridade", () => {
  it("agrega verificações e ignora as que faltam dado", () => {
    const verificacoes = auditarEmpresa({
      ticker: "WEGE3",
      modelo: "industrial",
      cotacao: 50,
      qtdAcoes: 1_000_000,
      marketCapBruto: 50_000_000,
      receita: 1000,
      lucro: 160,
      margemBruta: 0.35,
      margemLiquida: 0.16,
      roic: 0.3,
      dividaLiquida: -100,
      caixa: 200,
    });
    expect(verificacoes.length).toBeGreaterThan(0);
    const resumo = resumoSeveridade(verificacoes);
    expect(resumo.total).toBe(verificacoes.length);
    expect(resumo.critico).toBe(0);
  });

  it("empresa sem nenhum dado não quebra — devolve lista vazia", () => {
    const verificacoes = auditarEmpresa({
      ticker: "ZZZZ3",
      modelo: null,
      cotacao: null,
      qtdAcoes: null,
      marketCapBruto: null,
      receita: null,
      lucro: null,
      margemBruta: null,
      margemLiquida: null,
      roic: null,
      dividaLiquida: null,
      caixa: null,
    });
    expect(verificacoes).toEqual([]);
  });
});
