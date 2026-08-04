import { describe, expect, it } from "vitest";
import {
  calcularPortfolioFit,
  correlacaoPearson,
  MIN_PREGOES_CORRELACAO,
  LIMIAR_CONCENTRACAO_ATIVO,
  type CandidataPortfolioFit,
  type PosicaoExistente,
} from "./portfolio-fit";
import type { ObservacaoBenchmark } from "./patrimonio";

function datas(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `D${String(i).padStart(5, "0")}`);
}

const candidataBase: CandidataPortfolioFit = {
  ticker: "INTB3",
  setor: "Tecnologia",
  modelo: null,
  pesoProposto: 0.05,
  carryReal: 0.08,
  growthScore: null,
  alavancagem: 0.2,
  retencao: 0.5,
  volumeMedioReais: 5_000_000,
};

describe("correlacaoPearson", () => {
  it("séries idênticas: correlação 1", () => {
    expect(correlacaoPearson([1, 2, 3, 4], [1, 2, 3, 4])).toBeCloseTo(1, 10);
  });

  it("séries opostas: correlação -1", () => {
    expect(correlacaoPearson([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1, 10);
  });

  it("tamanhos diferentes ou vazio: null", () => {
    expect(correlacaoPearson([1, 2], [1])).toBeNull();
    expect(correlacaoPearson([], [])).toBeNull();
  });

  it("variância zero (série constante): null, nunca divide por zero", () => {
    expect(correlacaoPearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe("calcularPortfolioFit", () => {
  it("sem nenhuma posição na carteira: concentração e setor ficam no máximo, correlação fica null", () => {
    const r = calcularPortfolioFit(candidataBase, []);
    const concentracao = r.componentes.find((c) => c.id === "concentracao")!;
    const correlacao = r.componentes.find((c) => c.id === "correlacao")!;
    expect(concentracao.valor).toBe(100); // 5% bem abaixo do limiar de 15%
    expect(correlacao.valor).toBeNull();
    expect(r.scoreEncaixe).not.toBeNull();
  });

  it("posição que ultrapassaria o limiar de concentração individual é penalizada", () => {
    const candidataConcentrada: CandidataPortfolioFit = { ...candidataBase, pesoProposto: LIMIAR_CONCENTRACAO_ATIVO * 2 };
    const r = calcularPortfolioFit(candidataConcentrada, []);
    const concentracao = r.componentes.find((c) => c.id === "concentracao")!;
    expect(concentracao.valor).toBe(0); // exatamente no dobro do limiar → penalidade máxima da fórmula linear
  });

  it("setor já concentrado na carteira reduz o score de setor", () => {
    const posicoes: PosicaoExistente[] = [
      { ticker: "A", setor: "Tecnologia", pesoNaCarteira: 0.25 },
      { ticker: "B", setor: "Tecnologia", pesoNaCarteira: 0.25 },
    ];
    const r = calcularPortfolioFit(candidataBase, posicoes);
    const setor = r.componentes.find((c) => c.id === "setor")!;
    expect(setor.valor).toBeLessThan(100);
  });

  it("setor novo na carteira (não presente ainda): score de setor no máximo", () => {
    const posicoes: PosicaoExistente[] = [{ ticker: "A", setor: "Bancos", pesoNaCarteira: 0.5 }];
    const r = calcularPortfolioFit(candidataBase, posicoes);
    const setor = r.componentes.find((c) => c.id === "setor")!;
    expect(setor.valor).toBe(100);
  });

  it("correlação alta com a carteira reduz o score de correlação; correlação negativa aumenta", () => {
    const n = MIN_PREGOES_CORRELACAO + 10;
    const ds = datas(n);
    const precosCandidato: ObservacaoBenchmark[] = ds.map((data, i) => ({ data, valor: 100 * Math.pow(1.001, i) }));
    const precosCorrelacionados: ObservacaoBenchmark[] = ds.map((data, i) => ({ data, valor: 50 * Math.pow(1.001, i) })); // mesmo padrão → correlação ~1
    const precosOpostos: ObservacaoBenchmark[] = ds.map((data, i) => ({ data, valor: 50 * Math.pow(0.999, i) })); // padrão oposto → correlação ~-1

    const posicoesCorrelacionadas: PosicaoExistente[] = [{ ticker: "X", setor: "Outro", pesoNaCarteira: 0.5, precos: precosCorrelacionados }];
    const posicoesOpostas: PosicaoExistente[] = [{ ticker: "Y", setor: "Outro", pesoNaCarteira: 0.5, precos: precosOpostos }];

    const candidataComPreco: CandidataPortfolioFit = { ...candidataBase, precos: precosCandidato };
    const rAlta = calcularPortfolioFit(candidataComPreco, posicoesCorrelacionadas);
    const rBaixa = calcularPortfolioFit(candidataComPreco, posicoesOpostas);

    const corrAlta = rAlta.componentes.find((c) => c.id === "correlacao")!.valor!;
    const corrBaixa = rBaixa.componentes.find((c) => c.id === "correlacao")!.valor!;
    expect(corrBaixa).toBeGreaterThan(corrAlta);
  });

  it("histórico de preço curto demais (abaixo do mínimo de pregões): correlação null com motivo", () => {
    const ds = datas(MIN_PREGOES_CORRELACAO - 10);
    const precos: ObservacaoBenchmark[] = ds.map((data, i) => ({ data, valor: 100 + i }));
    const candidataComPreco: CandidataPortfolioFit = { ...candidataBase, precos };
    const posicoes: PosicaoExistente[] = [{ ticker: "X", setor: "Outro", pesoNaCarteira: 0.5, precos }];
    const r = calcularPortfolioFit(candidataComPreco, posicoes);
    const correlacao = r.componentes.find((c) => c.id === "correlacao")!;
    expect(correlacao.valor).toBeNull();
    expect(correlacao.explicacao.length).toBeGreaterThan(10);
  });

  it("carry/growth/liquidez ausentes viram null com motivo, nunca inventam número", () => {
    const candidataVazia: CandidataPortfolioFit = { ...candidataBase, carryReal: null, growthScore: null, volumeMedioReais: null };
    const r = calcularPortfolioFit(candidataVazia, []);
    expect(r.componentes.find((c) => c.id === "carry")!.valor).toBeNull();
    expect(r.componentes.find((c) => c.id === "growth")!.valor).toBeNull();
    expect(r.componentes.find((c) => c.id === "liquidez")!.valor).toBeNull();
    expect(r.scoreEncaixe).not.toBeNull(); // ainda calcula com o que sobrou
  });

  it("nunca usa linguagem de recomendação", () => {
    const r = calcularPortfolioFit(candidataBase, []);
    // "nunca é recomendação de compra ou venda" é o aviso obrigatório — só pode existir negado
    const texto = r.metodo.toLowerCase().replaceAll("nunca é recomendação de compra ou venda", "");
    expect(texto).not.toMatch(/\bcompre\b|\bvenda\b|recomend/);
  });
});
