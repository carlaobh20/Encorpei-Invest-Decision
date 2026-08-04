import { describe, expect, it } from "vitest";
import { gerarAprendizadosCarteira, type SaudeComparavel } from "./portfolio-lessons";

const BASE: SaudeComparavel = {
  concentracaoRotulo: "moderada",
  carryMedioPonderado: 0.08,
  qualityMedioPonderado: 60,
  alocacaoPorModelo: [{ rotulo: "Financeiro", pct: 0.3 }],
};

describe("gerarAprendizadosCarteira", () => {
  it("sem nenhuma mudança relevante, devolve lista vazia — nunca inventa lição", () => {
    expect(gerarAprendizadosCarteira(BASE, BASE, "PORTO3")).toEqual([]);
  });

  it("concentração melhora (banda cai) gera a frase de diversificação aumentada", () => {
    const r = gerarAprendizadosCarteira(BASE, { ...BASE, concentracaoRotulo: "baixa" }, "PORTO3");
    expect(r.some((l) => l.texto.includes("diversificação aumentou"))).toBe(true);
  });

  it("concentração piora (banda sobe) gera a frase de diversificação piorada", () => {
    const r = gerarAprendizadosCarteira(BASE, { ...BASE, concentracaoRotulo: "alta" }, "PORTO3");
    expect(r.some((l) => l.texto.includes("diversificação piorou"))).toBe(true);
  });

  it("Carry médio sobe acima do limiar gera a frase de proteção contra inflação melhorada", () => {
    const r = gerarAprendizadosCarteira(BASE, { ...BASE, carryMedioPonderado: 0.1 }, "PORTO3");
    expect(r.some((l) => l.texto.includes("proteção contra inflação melhorou"))).toBe(true);
  });

  it("Carry médio sobe abaixo do limiar não gera frase (ruído)", () => {
    const r = gerarAprendizadosCarteira(BASE, { ...BASE, carryMedioPonderado: 0.081 }, "PORTO3");
    expect(r.some((l) => l.texto.includes("proteção contra inflação"))).toBe(false);
  });

  it("Quality Score sobe acima do limiar gera a frase de qualidade média aumentada", () => {
    const r = gerarAprendizadosCarteira(BASE, { ...BASE, qualityMedioPonderado: 65 }, "PORTO3");
    expect(r.some((l) => l.texto.includes("qualidade média aumentou"))).toBe(true);
  });

  it("setor perde peso acima do limiar gera a frase de exposição setorial reduzida (exemplo literal da spec: setor financeiro)", () => {
    const r = gerarAprendizadosCarteira(BASE, { ...BASE, alocacaoPorModelo: [{ rotulo: "Financeiro", pct: 0.2 }] }, "PORTO3");
    expect(r.some((l) => l.texto.includes("exposição ao setor Financeiro caiu"))).toBe(true);
  });

  it("setor novo que não existia antes não quebra o comparador (trata como 0% antes)", () => {
    const r = gerarAprendizadosCarteira(BASE, { ...BASE, alocacaoPorModelo: [{ rotulo: "Financeiro", pct: 0.3 }, { rotulo: "Energia", pct: 0.1 }] }, "PORTO3");
    expect(r).toEqual([]); // Energia é setor NOVO (ganhou peso, não perdeu) — não deve gerar "caiu"
  });

  it("dado null em carry/quality não gera frase nem quebra (corte honesto)", () => {
    const r = gerarAprendizadosCarteira({ ...BASE, carryMedioPonderado: null, qualityMedioPonderado: null }, { ...BASE, carryMedioPonderado: null, qualityMedioPonderado: null }, "PORTO3");
    expect(r).toEqual([]);
  });
});
