import { describe, expect, it } from "vitest";
import { montarDecision, DECISION_OBJECT_VERSAO } from "./decision-object";
import { calcularMasterDecision, type EntradaMasterEngine } from "./master-engine";
import { calcularProbabilidadeHistoricaV2 } from "./probability-engine-v2";
import type { EmpresaAuditavel } from "./auditoria";
import type { CarryEntrada } from "./carry/types";
import type { ObservacaoBenchmark } from "./patrimonio";
import type { Evidencia } from "./evidence";

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
  marketCap: 10_000_000_000,
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
    fundamentosScore: 85,
    fundamentosComponentes: 4,
    compounderScore: 80,
    carryEntrada,
    technicalScore: 60,
  };
}

describe("montarDecision", () => {
  it("monta o objeto canônico com todos os campos, versão e timestamp", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const d = montarDecision({ resultado, empresa: "Intelbras", setor: "Tecnologia" }, "2026-08-04T12:00:00Z");

    expect(d.ticker).toBe("INTB3");
    expect(d.empresa).toBe("Intelbras");
    expect(d.setor).toBe("Tecnologia");
    expect(d.version).toBe(DECISION_OBJECT_VERSAO);
    expect(d.generatedAt).toBe("2026-08-04T12:00:00Z");
    expect(d.confluence).toBe(resultado.confluence.score);
    expect(d.conviccao).toBe(resultado.confluence.conviccao);
    expect(d.carryFloor).not.toBeNull(); // Floor sempre calculável quando há lucro e market cap
  });

  it("campos sem motor real hoje (growth/macro/consensus/management/portfolioFit/risk) vêm null com motivo em algum lugar da estrutura", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const d = montarDecision({ resultado, empresa: "Intelbras", setor: null }, "2026-08-04T12:00:00Z");

    expect(d.growth).toBeNull();
    expect(d.macro).toBeNull();
    expect(d.consensus).toBeNull();
    expect(d.management).toBeNull();
    expect(d.portfolioFit).toBeNull();
    expect(d.risk.nivel).toBeNull();
    expect(d.risk.motivo).not.toBeNull();
    // os 5 componentes pendentes do Confluence viram warnings (nunca some silenciosamente)
    expect(d.warnings.length).toBeGreaterThanOrEqual(5);
  });

  it("sem Probability V2 fornecida: expectedReturn/expectedDrawdown ficam indisponíveis com motivo, nunca inventam número", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const d = montarDecision({ resultado, empresa: "Intelbras", setor: null }, "2026-08-04T12:00:00Z");
    expect(d.expectedReturn.valor).toBeNull();
    expect(d.expectedReturn.motivo).not.toBeNull();
    expect(d.expectedDrawdown.valor).toBeNull();
    expect(d.confidenceInterval.nivelConfianca).toBeNull();
  });

  it("com Probability V2 destravada (12m): expectedReturn/expectedDrawdown vêm do horizonte de 12 meses", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const datas = Array.from({ length: 600 }, (_, i) => `D${String(i).padStart(5, "0")}`);
    const precos: ObservacaoBenchmark[] = datas.map((data, i) => ({ data, valor: 100 * Math.pow(1.001, i) }));
    const cdi: ObservacaoBenchmark[] = datas.map((data) => ({ data, valor: 0.03 }));
    const ibovespa: ObservacaoBenchmark[] = datas.map((data, i) => ({ data, valor: 100 * Math.pow(1.0002, i) }));
    const probV2 = calcularProbabilidadeHistoricaV2({ ticker: "INTB3", precos, cdi, ibovespa });

    const d = montarDecision({ resultado, empresa: "Intelbras", setor: null, probabilidadeV2: probV2 }, "2026-08-04T12:00:00Z");
    expect(d.expectedReturn.valor).not.toBeNull();
    expect(d.expectedReturn.valor).toBeCloseTo(probV2.horizontes[12].retornoEsperado.valor!, 10);
    expect(d.confidenceInterval.nivelConfianca).not.toBeNull();
    expect(d.probabilityHistorica).toBe(probV2);
  });

  it("FDIE crítico entra em blockingReasons, não em warnings (evita repetir o mesmo aviso duas vezes)", () => {
    const entrada = entradaBase();
    entrada.auditoria = { ...auditoriaOk, margemLiquida: 0.5 }; // crítico
    const resultado = calcularMasterDecision(entrada);
    const d = montarDecision({ resultado, empresa: "Intelbras", setor: null }, "2026-08-04T12:00:00Z");

    expect(d.blockingReasons.length).toBeGreaterThan(0);
    expect(d.blockingReasons[0]).toContain("FDIE");
    expect(d.warnings).not.toContain(d.blockingReasons[0]);
  });

  it("só inclui evidências ATIVAS do próprio ticker", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const evidencias: Evidencia[] = [
      {
        ticker: "INTB3",
        categoria: "margem",
        origem: "CVM",
        data: "2026-06-30",
        pesoInformativo: 0.5,
        confiabilidade: "alta",
        descricao: "x",
        timestamp: "t",
        hash: "h1",
        status: "ativa",
      },
      {
        ticker: "INTB3",
        categoria: "roic",
        origem: "CVM",
        data: "2026-03-31",
        pesoInformativo: -0.2,
        confiabilidade: "media",
        descricao: "y",
        timestamp: "t",
        hash: "h2",
        status: "refutada",
      },
      {
        ticker: "WEGE3",
        categoria: "margem",
        origem: "CVM",
        data: "2026-06-30",
        pesoInformativo: 0.5,
        confiabilidade: "alta",
        descricao: "z",
        timestamp: "t",
        hash: "h3",
        status: "ativa",
      },
    ];
    const d = montarDecision({ resultado, empresa: "Intelbras", setor: null, evidencias }, "2026-08-04T12:00:00Z");
    expect(d.evidences).toHaveLength(1);
    expect(d.evidences[0].hash).toBe("h1");
  });
});
