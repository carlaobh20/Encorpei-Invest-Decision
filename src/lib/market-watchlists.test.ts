import { describe, expect, it } from "vitest";
import { montarWatchlists, type EntradaWatchlist } from "./market-watchlists";

function base(over: Partial<EntradaWatchlist> = {}): EntradaWatchlist {
  return {
    ticker: "AAAA3",
    confluence: null,
    carry: null,
    quality: null,
    growth: null,
    compounderScore: null,
    marketCap: null,
    thesisStatus: null,
    roicVariacaoRelativa: null,
    comparacaoConfluenceSetor: "indisponivel",
    ...over,
  };
}

describe("montarWatchlists", () => {
  it("entrada vazia: todas as listas vazias, nunca quebra", () => {
    const w = montarWatchlists([]);
    expect(w.melhoraram).toEqual([]);
    expect(w.smallCapsPromissoras).toEqual([]);
  });

  it("tese fortalecendo entra em 'melhoraram'", () => {
    const w = montarWatchlists([base({ thesisStatus: "fortalecendo" })]);
    expect(w.melhoraram.map((i) => i.ticker)).toContain("AAAA3");
  });

  it("tese quebrada entra em 'pioraram'", () => {
    const w = montarWatchlists([base({ thesisStatus: "quebrada" })]);
    expect(w.pioraram.map((i) => i.ticker)).toContain("AAAA3");
  });

  it("compounder score acima do piso entra em compoundersHoje", () => {
    const w = montarWatchlists([base({ compounderScore: 85 })]);
    expect(w.compoundersHoje.map((i) => i.ticker)).toContain("AAAA3");
  });

  it("compounder score abaixo do piso não entra", () => {
    const w = montarWatchlists([base({ compounderScore: 30 })]);
    expect(w.compoundersHoje).toEqual([]);
  });

  it("turnaround exige tese fortalecendo E ROIC melhorando ao mesmo tempo", () => {
    const soStatus = montarWatchlists([base({ thesisStatus: "fortalecendo", roicVariacaoRelativa: null })]);
    expect(soStatus.turnarounds).toEqual([]);
    const ambos = montarWatchlists([base({ thesisStatus: "fortalecendo", roicVariacaoRelativa: 0.2 })]);
    expect(ambos.turnarounds.map((i) => i.ticker)).toContain("AAAA3");
  });

  it("quality growth exige os dois pisos ao mesmo tempo", () => {
    const soQuality = montarWatchlists([base({ quality: 80, growth: 30 })]);
    expect(soQuality.qualityGrowth).toEqual([]);
    const ambos = montarWatchlists([base({ quality: 80, growth: 80 })]);
    expect(ambos.qualityGrowth.map((i) => i.ticker)).toContain("AAAA3");
  });

  it("carry alto entra em proteção contra inflação", () => {
    const w = montarWatchlists([base({ carry: 0.12 })]);
    expect(w.altaProtecaoInflacao.map((i) => i.ticker)).toContain("AAAA3");
  });

  it("comparação setorial 'acima' entra em líderes do setor; 'indisponivel' não entra", () => {
    const acima = montarWatchlists([base({ comparacaoConfluenceSetor: "acima" })]);
    expect(acima.lideresSetor.map((i) => i.ticker)).toContain("AAAA3");
    const indisp = montarWatchlists([base({ comparacaoConfluenceSetor: "indisponivel" })]);
    expect(indisp.lideresSetor).toEqual([]);
  });

  it("small cap promissora exige teto de market cap E piso de confluence", () => {
    const soPequena = montarWatchlists([base({ marketCap: 1_000_000_000, confluence: 30 })]);
    expect(soPequena.smallCapsPromissoras).toEqual([]);
    const ambos = montarWatchlists([base({ marketCap: 1_000_000_000, confluence: 70 })]);
    expect(ambos.smallCapsPromissoras.map((i) => i.ticker)).toContain("AAAA3");
  });

  it("empresa grande demais não entra em small cap mesmo com confluence alta", () => {
    const w = montarWatchlists([base({ marketCap: 50_000_000_000, confluence: 90 })]);
    expect(w.smallCapsPromissoras).toEqual([]);
  });
});
