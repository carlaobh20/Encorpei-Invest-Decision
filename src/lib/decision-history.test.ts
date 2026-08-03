import { describe, expect, it } from "vitest";
import { avaliarDecisoes, type DecisaoEntrada } from "./decision-history";

const AGORA = "2026-08-03T12:00:00Z";

function base(overrides: Partial<DecisaoEntrada> = {}): DecisaoEntrada {
  return {
    id: 1,
    ticker: "WEGE3",
    decisao: "comprei",
    justificativa: "ROIC alto, margens estáveis.",
    criadoEm: "2026-06-01T12:00:00Z", // 63 dias antes de AGORA
    precoNaDecisao: 40,
    ...overrides,
  };
}

describe("avaliarDecisoes", () => {
  it("comprei + preço subiu → a_favor", () => {
    const [r] = avaliarDecisoes([base()], new Map([["WEGE3", 44]]), AGORA);
    expect(r.julgamento).toBe("a_favor");
    expect(r.variacaoPct).toBeCloseTo(0.1, 6);
  });

  it("comprei + preço caiu → contra", () => {
    const [r] = avaliarDecisoes([base()], new Map([["WEGE3", 36]]), AGORA);
    expect(r.julgamento).toBe("contra");
  });

  it("vendi + preço caiu depois → a_favor (evitou a queda)", () => {
    const [r] = avaliarDecisoes(
      [base({ decisao: "vendi" })],
      new Map([["WEGE3", 36]]),
      AGORA
    );
    expect(r.julgamento).toBe("a_favor");
  });

  it("vendi + preço subiu depois → contra (perdeu a alta)", () => {
    const [r] = avaliarDecisoes(
      [base({ decisao: "vendi" })],
      new Map([["WEGE3", 44]]),
      AGORA
    );
    expect(r.julgamento).toBe("contra");
  });

  it("mantive/observei NUNCA recebem julgamento direcional — sempre neutro", () => {
    const rs = avaliarDecisoes(
      [base({ decisao: "mantive" }), base({ id: 2, decisao: "observei" })],
      new Map([["WEGE3", 100]]), // variação enorme, não deveria mudar o julgamento
      AGORA
    );
    expect(rs[0].julgamento).toBe("neutro");
    expect(rs[1].julgamento).toBe("neutro");
  });

  it("sem preço na decisão ou sem preço atual → indisponível, nunca inventa", () => {
    const semPrecoDecisao = avaliarDecisoes([base({ precoNaDecisao: null })], new Map([["WEGE3", 44]]), AGORA);
    expect(semPrecoDecisao[0].julgamento).toBe("indisponivel");

    const semPrecoAtual = avaliarDecisoes([base()], new Map(), AGORA);
    expect(semPrecoAtual[0].julgamento).toBe("indisponivel");
  });

  it("menos de 30 dias: confiavel=false e o texto avisa que é cedo", () => {
    const [r] = avaliarDecisoes(
      [base({ criadoEm: "2026-08-01T12:00:00Z" })], // 2 dias antes de AGORA
      new Map([["WEGE3", 44]]),
      AGORA
    );
    expect(r.confiavel).toBe(false);
    expect(r.explicacaoJulgamento).toMatch(/ainda é cedo/);
  });

  it("30 dias ou mais: confiavel=true", () => {
    const [r] = avaliarDecisoes([base()], new Map([["WEGE3", 44]]), AGORA); // 63 dias
    expect(r.confiavel).toBe(true);
  });
});
