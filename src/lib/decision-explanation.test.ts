import { describe, expect, it } from "vitest";
import { gerarExplicacaoDecisao } from "./decision-explanation";
import { calcularMasterDecision, type EntradaMasterEngine } from "./master-engine";
import type { EmpresaAuditavel } from "./auditoria";
import type { CarryEntrada } from "./carry/types";
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
    technicalScore: 30, // baixo de propósito, pra testar motivo negativo
  };
}

describe("gerarExplicacaoDecisao", () => {
  it("classifica componentes disponíveis em positivo/negativo pelo limiar; pendências viram aviso", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z");

    expect(explicacao.ticker).toBe("INTB3");
    expect(explicacao.confluenceScore).toBe(resultado.confluence.score);
    // Quality (85/80 -> média 82.5, >=60) deve estar entre os positivos
    expect(explicacao.motivosPositivos.some((m) => m.origem === "confluence:quality")).toBe(true);
    // Technical 30 (<=40) deve estar entre os negativos
    expect(explicacao.motivosNegativos.some((m) => m.origem === "confluence:technical")).toBe(true);
    // Growth/Macro/Consensus/Management/Portfolio são pendência -> avisos, nunca motivo
    expect(explicacao.avisos.some((a) => a.startsWith("Growth"))).toBe(true);
    expect(explicacao.motivosPositivos.some((m) => m.origem.includes("growth"))).toBe(false);
    expect(explicacao.motivosNegativos.some((m) => m.origem.includes("growth"))).toBe(false);
  });

  it("fatores do Carry entram classificados por 'sustenta'/'atencao', sem recalcular nada", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z");
    const fatoresCarry = [...explicacao.motivosPositivos, ...explicacao.motivosNegativos].filter((m) => m.origem === "carry");
    expect(fatoresCarry.length).toBeGreaterThan(0);
    // os textos devem ser EXATAMENTE os do motor original (nunca reescritos)
    for (const f of fatoresCarry) {
      const existeNoOriginal = resultado.carry.melhor.resultado?.fatores.some((of) => of.texto === f.texto);
      expect(existeNoOriginal).toBe(true);
    }
  });

  it("FDIE crítico vira aviso, nunca motivo positivo/negativo", () => {
    const entrada = entradaBase();
    entrada.auditoria = { ...auditoriaOk, margemLiquida: 0.5 }; // crítico
    const resultado = calcularMasterDecision(entrada);
    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z");
    expect(explicacao.avisos.some((a) => a.startsWith("FDIE"))).toBe(true);
    expect(explicacao.motivosPositivos.some((m) => m.origem === "fdie")).toBe(false);
    expect(explicacao.motivosNegativos.some((m) => m.origem === "fdie")).toBe(false);
  });

  it("evidências ativas entram classificadas pelo sinal já registrado; inativas são ignoradas", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const evidencias: Evidencia[] = [
      {
        ticker: "INTB3",
        categoria: "margem",
        origem: "CVM",
        data: "2026-06-30",
        pesoInformativo: 0.8,
        confiabilidade: "alta",
        descricao: "Margem subiu forte",
        timestamp: "t",
        hash: "h1",
        status: "ativa",
      },
      {
        ticker: "INTB3",
        categoria: "roic",
        origem: "CVM",
        data: "2026-03-31",
        pesoInformativo: -0.5,
        confiabilidade: "media",
        descricao: "ROIC caiu (evidência antiga, substituída)",
        timestamp: "t",
        hash: "h2",
        status: "supersedida",
      },
    ];
    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z", { evidenciasAtivas: evidencias });
    expect(explicacao.motivosPositivos.some((m) => m.texto === "Margem subiu forte")).toBe(true);
    expect([...explicacao.motivosPositivos, ...explicacao.motivosNegativos].some((m) => m.texto.includes("substituída"))).toBe(false);
  });

  it("componente na faixa neutra (entre os limiares) não vira motivo nem positivo nem negativo", () => {
    const entrada = entradaBase();
    entrada.technicalScore = 50; // entre LIMIAR_NEGATIVO (40) e LIMIAR_POSITIVO (60)
    const resultado = calcularMasterDecision(entrada);
    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z");
    expect(explicacao.motivosPositivos.some((m) => m.origem === "confluence:technical")).toBe(false);
    expect(explicacao.motivosNegativos.some((m) => m.origem === "confluence:technical")).toBe(false);
  });

  it("fator de Carry rotulado 'atencao' entra em motivosNegativos", () => {
    const entrada = entradaBase();
    entrada.carryEntrada = { ...carryEntrada, caixaLiquido: false, alavancagem: 1.5 }; // gera fator "atencao" de dívida
    const resultado = calcularMasterDecision(entrada);
    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z");
    const negativosCarry = explicacao.motivosNegativos.filter((m) => m.origem === "carry");
    expect(negativosCarry.length).toBeGreaterThan(0);
  });

  it("Carry incalculável (Floor sem lucro/market cap): sem fatores, pendência surge via componente Confluence, não como motivo", () => {
    // Achado da auditoria (Módulo 7): o Floor SEMPRE devolve um `resultado` não-nulo
    // (mesmo com carryReal null, ver carry/escada.ts) — então o branch
    // `else if (resultado.carry.melhor.pendencia)` deste arquivo é hoje inalcançável
    // com o invariante atual do Carry Engine. A pendência ainda aparece, só que pelo
    // canal do componente "carry" do Confluence v2 (aviso), não por este branch.
    const entrada = entradaBase();
    entrada.carryEntrada = { ...carryEntrada, lucroLtm: null, marketCap: null };
    const resultado = calcularMasterDecision(entrada);
    expect(resultado.carry.melhor.resultado).not.toBeNull();
    expect(resultado.carry.melhor.resultado?.carryReal).toBeNull();
    expect(resultado.carry.melhor.resultado?.fatores).toHaveLength(0);

    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z");
    expect(explicacao.motivosPositivos.some((m) => m.origem === "carry")).toBe(false);
    expect(explicacao.motivosNegativos.some((m) => m.origem === "carry")).toBe(false);
    expect(explicacao.avisos.some((a) => a.startsWith("Carry (melhor degrau calculável)"))).toBe(true);
  });

  it("FDIE em alerta (não crítico) também vira aviso", () => {
    const entrada = entradaBase();
    // margem recalculada (lucro/receita=0.15) diverge ~7% da margem_liquida reportada (0.14) — banda "alerta", não "crítico"
    entrada.auditoria = { ...auditoriaOk, receita: 1000, lucro: 150, margemLiquida: 0.14, margemBruta: 0.4 };
    const resultado = calcularMasterDecision(entrada);
    expect(resultado.fdie.resumo.critico).toBe(0);
    expect(resultado.fdie.resumo.alerta).toBeGreaterThan(0);
    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z");
    expect(explicacao.avisos.some((a) => a.startsWith("FDIE") && a.includes("alerta"))).toBe(true);
  });

  it("evidência ativa com peso negativo entra em motivosNegativos", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const evidencias: Evidencia[] = [
      {
        ticker: "INTB3",
        categoria: "roic",
        origem: "CVM",
        data: "2026-06-30",
        pesoInformativo: -0.4,
        confiabilidade: "media",
        descricao: "ROIC caiu no trimestre",
        timestamp: "t",
        hash: "h1",
        status: "ativa",
      },
    ];
    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z", { evidenciasAtivas: evidencias });
    expect(explicacao.motivosNegativos.some((m) => m.texto === "ROIC caiu no trimestre")).toBe(true);
  });

  it("nunca gera texto livre — toda saída é estruturada (arrays de objetos, não parágrafo)", () => {
    const resultado = calcularMasterDecision(entradaBase());
    const explicacao = gerarExplicacaoDecisao(resultado, "2026-08-04T12:00:00Z");
    expect(Array.isArray(explicacao.motivosPositivos)).toBe(true);
    expect(Array.isArray(explicacao.motivosNegativos)).toBe(true);
    expect(Array.isArray(explicacao.avisos)).toBe(true);
    for (const m of [...explicacao.motivosPositivos, ...explicacao.motivosNegativos]) {
      expect(typeof m.texto).toBe("string");
      expect(typeof m.origem).toBe("string");
    }
  });
});
