import { describe, expect, it } from "vitest";
import { montarCasoHistorico, registrarDesfecho } from "./research-case";
import { montarDecision } from "./decision-object";
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

function decisionFake() {
  const resultado = calcularMasterDecision(entradaBase());
  return montarDecision({ resultado, empresa: "Intelbras", setor: "Tecnologia" }, "2026-08-04T12:00:00Z");
}

describe("montarCasoHistorico", () => {
  it("empacota o Decision Object inteiro como snapshot, sem duplicar campos", () => {
    const decision = decisionFake();
    const caso = montarCasoHistorico(decision, "radar", "2026-08-04");
    expect(caso.ticker).toBe("INTB3");
    expect(caso.origem).toBe("radar");
    expect(caso.snapshot).toBe(decision); // mesma referência — nenhuma cópia parcial
    expect(caso.desfecho).toBeNull();
  });

  it("funciona para empresas fora da carteira (origem 'radar'/'manual'), não só 'carteira'", () => {
    const decision = decisionFake();
    const casoRadar = montarCasoHistorico(decision, "radar", "2026-08-04");
    const casoManual = montarCasoHistorico(decision, "manual", "2026-08-04");
    expect(casoRadar.origem).toBe("radar");
    expect(casoManual.origem).toBe("manual");
  });
});

describe("registrarDesfecho", () => {
  it("anexa desfecho sem mutar o caso original (imutabilidade)", () => {
    const decision = decisionFake();
    const casoOriginal = montarCasoHistorico(decision, "carteira", "2026-08-04");
    const desfecho = { dataAvaliacao: "2027-08-04", retornoRealizado: 0.15, superouCdi: true, superouIbovespa: true };
    const casoComDesfecho = registrarDesfecho(casoOriginal, desfecho);

    expect(casoOriginal.desfecho).toBeNull(); // original intacto
    expect(casoComDesfecho.desfecho).toEqual(desfecho);
    expect(casoComDesfecho).not.toBe(casoOriginal); // novo objeto, não mutação
  });
});
