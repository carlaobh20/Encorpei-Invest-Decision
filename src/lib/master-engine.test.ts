import { describe, expect, it } from "vitest";
import { calcularMasterDecision, type EntradaMasterEngine } from "./master-engine";
import type { EmpresaAuditavel } from "./auditoria";
import type { CarryEntrada } from "./carry/types";

const auditoriaOk: EmpresaAuditavel = {
  ticker: "INTB3",
  modelo: null,
  cotacao: 20,
  qtdAcoes: 100,
  marketCapBruto: 2000,
  receita: 1000,
  lucro: 200,
  margemBruta: 0.4,
  margemLiquida: 0.2,
  roic: null,
  dividaLiquida: null,
  caixa: 500,
};

const carryEntrada: CarryEntrada = {
  lucroLtm: 600_000_000,
  marketCap: 10_000_000_000, // 6%
  roic4: 0.2,
  margensDesvio: 0.02,
  caixaLiquido: true,
  alavancagem: null,
  crescReceitaAnual: 0.1,
  ehFinanceira: false,
};

function entradaBase(): EntradaMasterEngine {
  return {
    ticker: "INTB3",
    auditoria: auditoriaOk,
    fundamentosScore: 80,
    fundamentosComponentes: 4,
    compounderScore: 70,
    carryEntrada,
    technicalScore: 60,
  };
}

describe("calcularMasterDecision", () => {
  it("roda o fluxo completo e devolve FDIE, Carry, Confluence e Decision", () => {
    const r = calcularMasterDecision(entradaBase());
    expect(r.ticker).toBe("INTB3");
    expect(r.fdie.verificacoes.length).toBeGreaterThan(0);
    expect(r.carry.degraus).toHaveLength(5);
    expect(r.carry.melhor.resultado?.carryReal).toBeCloseTo(0.06, 3);
    expect(r.confluence.score).not.toBeNull();
    expect(r.decisao.bloqueadaPorFdie).toBe(false);
    expect(r.probabilidade).toBeNull(); // não passou decisoesAvaliadas
  });

  it("FDIE crítico bloqueia a decisão com explicação explícita", () => {
    const entrada = entradaBase();
    entrada.auditoria = { ...auditoriaOk, margemLiquida: 0.5 }; // > margem bruta 0.4 → impossível, crítico
    const r = calcularMasterDecision(entrada);
    expect(r.fdie.resumo.critico).toBeGreaterThan(0);
    expect(r.decisao.bloqueadaPorFdie).toBe(true);
    expect(r.decisao.explicacao).toContain("crítica");
  });

  it("usa o melhor degrau do Carry (Cash > Growth > Floor) dentro da Confluence", () => {
    const entrada = entradaBase();
    entrada.carryEntrada = {
      ...carryEntrada,
      dividendosJcpLtm: -180_000_000,
      caixaOperacionalLtm: 800_000_000,
      capexLtm: -200_000_000,
    };
    const r = calcularMasterDecision(entrada);
    expect(r.carry.melhor.nivel).toBe(3); // Cash
    const carryComponente = r.confluence.componentes.find((c) => c.id === "carry");
    expect(carryComponente?.valor).not.toBeNull();
  });

  it("sem nenhum dado: FDIE vazio, Confluence null, decisão ainda explica (nunca quebra)", () => {
    const r = calcularMasterDecision({
      ticker: "XYZW3",
      auditoria: {
        ticker: "XYZW3",
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
      },
      fundamentosScore: null,
      fundamentosComponentes: 0,
      compounderScore: null,
      carryEntrada: { ...carryEntrada, lucroLtm: null, marketCap: null, roic4: null, caixaLiquido: null, crescReceitaAnual: null },
      technicalScore: null,
    });
    expect(r.fdie.verificacoes).toHaveLength(0);
    expect(r.confluence.score).toBeNull();
    expect(r.decisao.explicacao.length).toBeGreaterThan(0);
  });

  it("com decisoesAvaliadas: probabilidade é calculada e entra na explicação", () => {
    const entrada = entradaBase();
    entrada.decisoesAvaliadas = [
      {
        id: 1,
        ticker: "INTB3",
        decisao: "comprei",
        justificativa: "x",
        criadoEm: "2026-01-01T00:00:00Z",
        precoNaDecisao: 10,
        precoAtual: 11,
        variacaoPct: 0.1,
        diasDecorridos: 60,
        julgamento: "a_favor",
        explicacaoJulgamento: "x",
        confiavel: true,
      },
    ];
    const r = calcularMasterDecision(entrada);
    expect(r.probabilidade).not.toBeNull();
    expect(r.probabilidade?.probabilidade).toBeCloseTo(1, 10);
  });

  it("trava de linguagem: nunca diz compre/venda em nenhum texto do resultado", () => {
    const r = calcularMasterDecision(entradaBase());
    // "nunca diz compre/venda" é o aviso obrigatório — só pode existir negado
    const texto = [r.decisao.explicacao, r.metodo].join(" ").toLowerCase().replaceAll("nunca diz compre/venda", "");
    expect(texto).not.toMatch(/\bcompre\b|\bvenda\b|recomend/);
  });
});
