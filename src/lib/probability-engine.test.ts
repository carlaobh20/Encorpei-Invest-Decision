import { describe, expect, it } from "vitest";
import { calcularProbabilidade, LIMIARES_CONFIABILIDADE } from "./probability-engine";
import type { DecisaoAvaliada, Julgamento } from "./decision-history";

function fake(julgamento: Julgamento, confiavel: boolean): DecisaoAvaliada {
  return {
    id: 1,
    ticker: "TEST3",
    decisao: "comprei",
    justificativa: "teste",
    criadoEm: "2026-01-01T00:00:00Z",
    precoNaDecisao: 10,
    precoAtual: 11,
    variacaoPct: 0.1,
    diasDecorridos: 60,
    julgamento,
    explicacaoJulgamento: "teste",
    confiavel,
  };
}

describe("calcularProbabilidade", () => {
  it("sem decisões: probabilidade null, confiabilidade insuficiente — nunca inventa", () => {
    const r = calcularProbabilidade([]);
    expect(r.probabilidade).toBeNull();
    expect(r.confiabilidade).toBe("insuficiente");
    expect(r.baseEstatistica.observacoes).toBe(0);
  });

  it("só decisões neutras/indisponíveis/pouco tempo: nenhuma entra na base", () => {
    const r = calcularProbabilidade([fake("neutro", true), fake("indisponivel", true), fake("a_favor", false)]);
    expect(r.probabilidade).toBeNull();
    expect(r.baseEstatistica.observacoes).toBe(0);
    expect(r.baseEstatistica.neutro).toBe(1);
    expect(r.baseEstatistica.descartadasSemPreco).toBe(1);
    expect(r.baseEstatistica.descartadasPoucoTempo).toBe(1);
  });

  it("3 a_favor e 1 contra (confiáveis): probabilidade 75%, ainda insuficiente (< 5 obs)", () => {
    const r = calcularProbabilidade([
      fake("a_favor", true),
      fake("a_favor", true),
      fake("a_favor", true),
      fake("contra", true),
    ]);
    expect(r.probabilidade).toBeCloseTo(0.75, 10);
    expect(r.baseEstatistica.observacoes).toBe(4);
    expect(r.confiabilidade).toBe("insuficiente");
  });

  it("limiares de confiabilidade batem com LIMIARES_CONFIABILIDADE", () => {
    const decisoesConfiaveis = (n: number) => Array.from({ length: n }, () => fake("a_favor", true));

    expect(calcularProbabilidade(decisoesConfiaveis(LIMIARES_CONFIABILIDADE.baixa - 1)).confiabilidade).toBe(
      "insuficiente"
    );
    expect(calcularProbabilidade(decisoesConfiaveis(LIMIARES_CONFIABILIDADE.baixa)).confiabilidade).toBe("baixa");
    expect(calcularProbabilidade(decisoesConfiaveis(LIMIARES_CONFIABILIDADE.media)).confiabilidade).toBe("media");
    expect(calcularProbabilidade(decisoesConfiaveis(LIMIARES_CONFIABILIDADE.alta)).confiabilidade).toBe("alta");
  });

  it("neutro/indisponível não entram no denominador da probabilidade", () => {
    const r = calcularProbabilidade([
      fake("a_favor", true),
      fake("contra", true),
      fake("neutro", true),
      fake("neutro", true),
      fake("indisponivel", true),
    ]);
    expect(r.baseEstatistica.observacoes).toBe(2); // só a_favor + contra
    expect(r.probabilidade).toBeCloseTo(0.5, 10);
  });

  it("explicação sempre presente e nunca promete resultado futuro", () => {
    const r = calcularProbabilidade([fake("a_favor", true), fake("contra", true)]);
    expect(r.explicacao.length).toBeGreaterThan(20);
    expect(r.explicacao.toLowerCase()).not.toMatch(/garantid|prometid|compre|venda|recomend/);
  });
});
