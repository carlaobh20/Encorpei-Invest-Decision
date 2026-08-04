import { describe, expect, it } from "vitest";
import { compararComSetor, mediaSetor, fraseCarryComContexto, fraseConfluenceComContexto } from "./dash-narrativa";

describe("compararComSetor", () => {
  it("valor ou média null: indisponível", () => {
    expect(compararComSetor(null, 0.1)).toBe("indisponivel");
    expect(compararComSetor(0.1, null)).toBe("indisponivel");
  });
  it("acima/abaixo da média fora da margem de empate", () => {
    expect(compararComSetor(0.15, 0.1)).toBe("acima");
    expect(compararComSetor(0.05, 0.1)).toBe("abaixo");
  });
  it("diferença desprezível conta como na média — nunca 'acima' por 0,01pp", () => {
    expect(compararComSetor(0.1001, 0.1)).toBe("na_media");
  });
});

describe("mediaSetor", () => {
  const linhas = [
    { ticker: "AAAA3", setor: "Tecnologia" },
    { ticker: "BBBB3", setor: "Tecnologia" },
    { ticker: "CCCC3", setor: "Bancos" },
  ];
  const valores = new Map([["AAAA3", 0.1], ["BBBB3", 0.2], ["CCCC3", 0.5]]);
  const valorDe = (l: { ticker: string }) => valores.get(l.ticker) ?? null;

  it("exclui o próprio ticker do cálculo", () => {
    // média do setor Tecnologia excluindo AAAA3 = só BBBB3 = 0.2
    expect(mediaSetor("AAAA3", "Tecnologia", linhas, valorDe)).toBe(0.2);
  });
  it("setor null: indisponível", () => {
    expect(mediaSetor("AAAA3", null, linhas, valorDe)).toBeNull();
  });
  it("sem nenhum outro ticker do mesmo setor: indisponível", () => {
    expect(mediaSetor("CCCC3", "Bancos", linhas, valorDe)).toBeNull();
  });
});

describe("fraseCarryComContexto", () => {
  it("carry null: frase honesta sem número", () => {
    expect(fraseCarryComContexto(null, "acima")).toBe("Carry indisponível para esta empresa.");
  });
  it("nunca usa a palavra 'histórica' — só compara contra a média de hoje", () => {
    const frase = fraseCarryComContexto(0.118, "acima");
    expect(frase).not.toMatch(/histór/i);
    expect(frase).toContain("hoje");
    expect(frase).toContain("IPCA+11,8%");
  });
  it("cobre os 4 casos de comparação", () => {
    expect(fraseCarryComContexto(0.1, "abaixo")).toContain("abaixo");
    expect(fraseCarryComContexto(0.1, "na_media")).toContain("na média");
    expect(fraseCarryComContexto(0.1, "indisponivel")).toContain("sem média setorial");
  });
});

describe("fraseConfluenceComContexto", () => {
  it("score null: frase honesta sem número", () => {
    expect(fraseConfluenceComContexto(null, "acima")).toBe("Confluence indisponível para esta empresa.");
  });
  it("cobre os 4 casos de comparação", () => {
    expect(fraseConfluenceComContexto(70, "acima")).toContain("acima");
    expect(fraseConfluenceComContexto(70, "abaixo")).toContain("abaixo");
    expect(fraseConfluenceComContexto(70, "na_media")).toContain("na média");
    expect(fraseConfluenceComContexto(70, "indisponivel")).toContain("sem média setorial");
  });
});
