import { describe, expect, it } from "vitest";
import { calcularAlocacaoCapital, PISO_CONFLUENCE_ALOCACAO, type CandidatoAlocacao } from "./capital-allocation";
import { LIMIAR_CONCENTRACAO_ATIVO } from "./portfolio-fit";

describe("calcularAlocacaoCapital", () => {
  it("nenhum candidato: 100% em caixa", () => {
    const r = calcularAlocacaoCapital([]);
    expect(r.itens).toHaveLength(0);
    expect(r.percentualCaixa).toBe(1);
    expect(r.avisos.some((a) => a.includes("Nenhum candidato elegível"))).toBe(true);
  });

  it("candidato com Confluence null fica de fora, com aviso — nunca vira zero silencioso", () => {
    const candidatos: CandidatoAlocacao[] = [{ ticker: "AAAA3", confluenceScore: null }];
    const r = calcularAlocacaoCapital(candidatos);
    expect(r.itens).toHaveLength(0);
    expect(r.percentualCaixa).toBe(1);
    expect(r.avisos.some((a) => a.includes("AAAA3") && a.includes("indisponível"))).toBe(true);
  });

  it("candidato abaixo do piso de Confluence fica de fora, com aviso explicando o motivo", () => {
    const candidatos: CandidatoAlocacao[] = [
      { ticker: "BBBB3", confluenceScore: PISO_CONFLUENCE_ALOCACAO - 1 },
      { ticker: "CCCC3", confluenceScore: PISO_CONFLUENCE_ALOCACAO + 10 },
    ];
    const r = calcularAlocacaoCapital(candidatos);
    expect(r.itens.map((i) => i.ticker)).toEqual(["CCCC3"]);
    expect(r.avisos.some((a) => a.includes("BBBB3") && a.includes("abaixo do piso"))).toBe(true);
  });

  it("distribui proporcionalmente ao Confluence entre elegíveis, somando com o caixa a 1", () => {
    const candidatos: CandidatoAlocacao[] = [
      { ticker: "DDDD3", confluenceScore: 60 },
      { ticker: "EEEE3", confluenceScore: 60 },
    ];
    // ambos abaixo do teto de concentração individual quando divididos igualmente
    const r = calcularAlocacaoCapital(candidatos, { limiarConcentracaoMax: 0.8 });
    expect(r.itens).toHaveLength(2);
    expect(r.itens[0].percentual).toBeCloseTo(r.itens[1].percentual, 6); // pesos iguais → partes iguais
    const soma = r.itens.reduce((a, i) => a + i.percentual, 0) + r.percentualCaixa;
    expect(soma).toBeCloseTo(1, 6);
  });

  it("candidato cujo peso proporcional excederia o teto de concentração é limitado, e o excedente redistribuído", () => {
    const candidatos: CandidatoAlocacao[] = [
      { ticker: "FFFF3", confluenceScore: 90 }, // dominante
      { ticker: "GGGG3", confluenceScore: 55 },
      { ticker: "HHHH3", confluenceScore: 55 },
    ];
    const r = calcularAlocacaoCapital(candidatos, { limiarConcentracaoMax: LIMIAR_CONCENTRACAO_ATIVO });
    const dominante = r.itens.find((i) => i.ticker === "FFFF3")!;
    expect(dominante.percentual).toBeCloseTo(LIMIAR_CONCENTRACAO_ATIVO, 6);
    expect(r.avisos.some((a) => a.includes("FFFF3") && a.includes("teto de concentração"))).toBe(true);
    const soma = r.itens.reduce((a, i) => a + i.percentual, 0) + r.percentualCaixa;
    expect(soma).toBeCloseTo(1, 6);
  });

  it("premissas sempre listam piso de Confluence e teto de concentração usados", () => {
    const r = calcularAlocacaoCapital([{ ticker: "IIII3", confluenceScore: 70 }], { pisoConfluence: 40, limiarConcentracaoMax: 0.25 });
    expect(r.premissas.some((p) => p.includes("40"))).toBe(true);
    expect(r.premissas.some((p) => p.includes("25%"))).toBe(true);
  });

  it("nunca usa linguagem de recomendação", () => {
    const r = calcularAlocacaoCapital([{ ticker: "JJJJ3", confluenceScore: 70 }]);
    const textoMetodo = r.metodo.toLowerCase().replaceAll("nunca uma recomendação de compra ou venda", "");
    const textoPremissas = r.premissas.join(" ").toLowerCase().replaceAll("cálculo mecânico, não uma recomendação de compra ou venda", "");
    expect(textoMetodo).not.toMatch(/\bcompre\b|\bvenda\b|recomend/);
    expect(textoPremissas).not.toMatch(/\bcompre\b|\bvenda\b|recomend/);
  });
});
