import { describe, expect, it } from "vitest";
import { calcularCompounder } from "./v1";
import { sensibilidadeJuros } from "./sensibilidade-juros";
import type { CompounderEntrada } from "./types";

const BASE: CompounderEntrada = {
  ticker: "TEST3",
  receitaAnoAtual: null,
  receitaAnoAnterior: null,
  lucroAnoAtual: null,
  lucroAnoAnterior: null,
  roic4tri: null,
  lucroLtm: null,
  dividendosJcpLtm: null,
  caixaOperacionalLtm: null,
  capexLtm: null,
  marketCap: null,
  margensTrimestrais: [],
  recomprasLtm: null,
  ehFinanceira: false,
};

describe("calcularCompounder", () => {
  it("sem nenhum dado: score null, 0 componentes disponíveis, confiança baixa", () => {
    const r = calcularCompounder(BASE);
    expect(r.score).toBeNull();
    expect(r.componentesDisponiveis).toBe(0);
    expect(r.confianca).toBe("baixa");
  });

  it("empresa de altíssima qualidade em todos os eixos disponíveis pontua alto", () => {
    const r = calcularCompounder({
      ...BASE,
      receitaAnoAtual: 130,
      receitaAnoAnterior: 100,
      lucroAnoAtual: 140,
      lucroAnoAnterior: 100,
      roic4tri: 0.32,
      lucroLtm: 1000,
      dividendosJcpLtm: -150, // paga pouco, retém muito
      caixaOperacionalLtm: 1100,
      capexLtm: -200,
      marketCap: 12000,
      margensTrimestrais: [0.22, 0.2, 0.18, 0.17],
      recomprasLtm: -50,
      ehFinanceira: false,
    });
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThan(75);
    expect(r.componentesDisponiveis).toBeGreaterThanOrEqual(6);
    expect(r.confianca).toBe("alta");
  });

  it("banco: ROIC fica nulo (regra setorial), resto pode calcular", () => {
    const r = calcularCompounder({
      ...BASE,
      roic4tri: 0.18,
      ehFinanceira: true,
    });
    const roic = r.componentes.find((c) => c.id === "roic");
    expect(roic?.valor).toBeNull();
  });

  it("gestão e runway sempre nulos na v1 (curadoria manual, não inventa)", () => {
    const r = calcularCompounder(BASE);
    expect(r.componentes.find((c) => c.id === "gestao")?.valor).toBeNull();
    expect(r.componentes.find((c) => c.id === "runway")?.valor).toBeNull();
  });

  it("renormaliza o peso entre os componentes disponíveis (não penaliza automaticamente por dado faltante)", () => {
    const r = calcularCompounder({
      ...BASE,
      roic4tri: 0.3, // só este componente disponível
    });
    expect(r.componentesDisponiveis).toBe(1);
    expect(r.score).not.toBeNull();
    // com só ROIC disponível, o score deve refletir diretamente a nota do ROIC
    const roic = r.componentes.find((c) => c.id === "roic")!;
    expect(r.score).toBe(Math.round(roic.valor!));
  });

  it("diluição: recompra positiva pontua acima do neutro; sem recompra fica no neutro com aviso", () => {
    const comRecompra = calcularCompounder({ ...BASE, recomprasLtm: -100, marketCap: 10000 });
    const semRecompra = calcularCompounder({ ...BASE, recomprasLtm: 0, marketCap: 10000 });
    const vComRecompra = comRecompra.componentes.find((c) => c.id === "diluicao")!.valor!;
    const vSemRecompra = semRecompra.componentes.find((c) => c.id === "diluicao")!.valor!;
    expect(vComRecompra).toBeGreaterThan(vSemRecompra);
  });
});

describe("sensibilidadeJuros", () => {
  it("sem dado: categoria null", () => {
    const r = sensibilidadeJuros({ alavancagem: null, retencao: null, modelo: null });
    expect(r.categoria).toBeNull();
  });

  it("alavancagem alta + retenção alta + modelo intensivo em capital: sensibilidade muito alta", () => {
    const r = sensibilidadeJuros({ alavancagem: 2.0, retencao: 0.8, modelo: "shopping_imobiliario" });
    expect(r.categoria).toBe("muito_alta");
  });

  it("caixa líquido + distribui quase tudo + modelo leve: sensibilidade muito baixa", () => {
    const r = sensibilidadeJuros({ alavancagem: -0.2, retencao: 0.1, modelo: "software" });
    expect(r.categoria).toBe("muito_baixa");
  });

  it("nunca decide só pelo setor: alavancagem e retenção sozinhas já produzem categoria sem modelo", () => {
    const r = sensibilidadeJuros({ alavancagem: 1.8, retencao: 0.75, modelo: null });
    expect(r.categoria).not.toBeNull();
  });
});
