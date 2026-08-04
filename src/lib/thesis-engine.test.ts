import { describe, expect, it } from "vitest";
import {
  classificarStatusDerivado,
  calcularIdadeTese,
  montarPerfilTese,
  LIMIAR_TESE_NOVA_DIAS,
  type ItemEstruturaTese,
} from "./thesis-engine";
import { montarDecision } from "./decision-object";
import { calcularMasterDecision, type EntradaMasterEngine } from "./master-engine";
import type { EmpresaAuditavel } from "./auditoria";
import type { CarryEntrada } from "./carry/types";

describe("calcularIdadeTese", () => {
  it("calcula dias corridos entre criação e agora", () => {
    expect(calcularIdadeTese("2026-01-01T00:00:00Z", "2026-01-31T00:00:00Z")).toBe(30);
  });

  it("nunca retorna negativo (agora antes da criação, por algum motivo de fuso)", () => {
    expect(calcularIdadeTese("2026-01-31T00:00:00Z", "2026-01-01T00:00:00Z")).toBe(0);
  });
});

describe("classificarStatusDerivado", () => {
  it("quebrada sempre vence, mesmo com strength positiva", () => {
    const r = classificarStatusDerivado({ statusReal: "quebrada", idadeDias: 500, strengthDirecao: "mais_forte" });
    expect(r).toBe("quebrada");
  });

  it("invalidada manualmente sempre vence, até sobre quebrada", () => {
    const r = classificarStatusDerivado({ statusReal: "quebrada", idadeDias: 500, strengthDirecao: null, invalidadaManualmente: true });
    expect(r).toBe("invalida");
  });

  it("tese nova (idade < limiar) é sempre 'construindo', mesmo válida e forte", () => {
    const r = classificarStatusDerivado({
      statusReal: "valida",
      idadeDias: LIMIAR_TESE_NOVA_DIAS - 1,
      strengthDirecao: "mais_forte",
    });
    expect(r).toBe("construindo");
  });

  it("válida + mais_forte (idade suficiente) → fortalecendo", () => {
    const r = classificarStatusDerivado({ statusReal: "valida", idadeDias: 100, strengthDirecao: "mais_forte" });
    expect(r).toBe("fortalecendo");
  });

  it("válida + mais_fraca → enfraquecendo", () => {
    const r = classificarStatusDerivado({ statusReal: "valida", idadeDias: 100, strengthDirecao: "mais_fraca" });
    expect(r).toBe("enfraquecendo");
  });

  it("válida + neutra/sem dado → confirmada", () => {
    expect(classificarStatusDerivado({ statusReal: "valida", idadeDias: 100, strengthDirecao: "neutra" })).toBe("confirmada");
    expect(classificarStatusDerivado({ statusReal: "valida", idadeDias: 100, strengthDirecao: null })).toBe("confirmada");
  });

  it("em_revisao + gatilho positivo → fortalecendo (oportunidade, não risco)", () => {
    const r = classificarStatusDerivado({ statusReal: "em_revisao", idadeDias: 100, strengthDirecao: null, ultimoGatilhoDirecao: "positivo" });
    expect(r).toBe("fortalecendo");
  });

  it("em_revisao + gatilho negativo ou desconhecido → enfraquecendo (lado cauteloso)", () => {
    expect(classificarStatusDerivado({ statusReal: "em_revisao", idadeDias: 100, strengthDirecao: null, ultimoGatilhoDirecao: "negativo" })).toBe(
      "enfraquecendo"
    );
    expect(classificarStatusDerivado({ statusReal: "em_revisao", idadeDias: 100, strengthDirecao: null })).toBe("enfraquecendo");
  });
});

describe("montarPerfilTese", () => {
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
  const entradaMaster: EntradaMasterEngine = {
    ticker: "INTB3",
    auditoria: auditoriaOk,
    fundamentosScore: 85,
    fundamentosComponentes: 4,
    compounderScore: 80,
    carryEntrada,
    technicalScore: 60,
  };

  function decisionFake() {
    const resultado = calcularMasterDecision(entradaMaster);
    return montarDecision({ resultado, empresa: "Intelbras", setor: "Tecnologia" }, "2026-08-04T12:00:00Z");
  }

  it("reaproveita Decision.confluence como thesisScore — nunca recalcula", () => {
    const decision = decisionFake();
    const perfil = montarPerfilTese({
      decision,
      teseVersao: 2,
      teseCriadoEm: "2025-01-01T00:00:00Z",
      agora: "2026-08-04T12:00:00Z",
      statusReal: "valida",
      strengthDirecao: "mais_forte",
      strengthDelta: 8,
      estrutura: [],
    });
    expect(perfil.thesisScore).toBe(decision.confluence);
    expect(perfil.thesisVersion).toBe(2);
    expect(perfil.thesisStatus).toBe("fortalecendo");
    expect(perfil.thesisStrength).toBe(8);
  });

  it("separa a estrutura qualitativa por tipo, ignorando itens inativos", () => {
    const decision = decisionFake();
    const estrutura: ItemEstruturaTese[] = [
      { tipo: "premissa", texto: "Líder de mercado", evidenciaId: null, ativo: true },
      { tipo: "risco", texto: "Concorrência internacional", evidenciaId: null, ativo: true },
      { tipo: "risco", texto: "Risco antigo já superado", evidenciaId: null, ativo: false },
      { tipo: "catalisador", texto: "Novo produto", evidenciaId: 10, ativo: true },
    ];
    const perfil = montarPerfilTese({
      decision,
      teseVersao: 1,
      teseCriadoEm: "2025-01-01T00:00:00Z",
      agora: "2026-08-04T12:00:00Z",
      statusReal: "valida",
      strengthDirecao: null,
      strengthDelta: null,
      estrutura,
    });
    expect(perfil.premissas).toHaveLength(1);
    expect(perfil.riscos).toHaveLength(1); // o inativo some
    expect(perfil.catalisadores).toHaveLength(1);
    expect(perfil.catalisadores[0].evidenciaId).toBe(10);
    expect(perfil.evidencias).toHaveLength(0);
    expect(perfil.objetivos).toHaveLength(0);
    expect(perfil.hipoteses).toHaveLength(0);
    expect(perfil.fatoresNegativos).toHaveLength(0);
  });
});
