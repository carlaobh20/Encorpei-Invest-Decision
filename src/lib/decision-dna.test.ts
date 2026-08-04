import { describe, expect, it } from "vitest";
import { MIN_OBS_FATOR, resumirFatores, type DecisaoComFatores } from "./decision-dna";
import type { Julgamento } from "./decision-history";

function fake(julgamento: Julgamento, confiavel: boolean, fatores: { chave: string; valor: string }[]): DecisaoComFatores {
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
    fatores,
  };
}

const FATOR_ALTA = { chave: "confluenceConviccao", valor: "alta" };
const FATOR_BAIXA = { chave: "confluenceConviccao", valor: "baixa" };

describe("resumirFatores", () => {
  it("sem decisões: lista vazia", () => {
    expect(resumirFatores([])).toEqual([]);
  });

  it("ignora decisões não confiáveis (< 30 dias) e não direcionais (neutro/indisponível)", () => {
    const r = resumirFatores([
      fake("a_favor", false, [FATOR_ALTA]),
      fake("neutro", true, [FATOR_ALTA]),
      fake("indisponivel", true, [FATOR_ALTA]),
    ]);
    expect(r).toEqual([]);
  });

  it("abaixo do MIN_OBS_FATOR: taxaAFavor null, mas conta observações", () => {
    const r = resumirFatores([fake("a_favor", true, [FATOR_ALTA]), fake("a_favor", true, [FATOR_ALTA])]);
    expect(r).toHaveLength(1);
    expect(r[0].observacoes).toBe(2);
    expect(r[0].taxaAFavor).toBeNull();
    expect(r[0].explicacao).toContain(String(MIN_OBS_FATOR));
  });

  it("no mínimo de observações: reporta taxa", () => {
    const r = resumirFatores([
      fake("a_favor", true, [FATOR_ALTA]),
      fake("a_favor", true, [FATOR_ALTA]),
      fake("contra", true, [FATOR_ALTA]),
    ]);
    expect(r[0].observacoes).toBe(3);
    expect(r[0].taxaAFavor).toBeCloseTo(2 / 3, 10);
  });

  it("separa por chave+valor — 'alta' e 'baixa' não se misturam", () => {
    const r = resumirFatores([
      fake("a_favor", true, [FATOR_ALTA]),
      fake("a_favor", true, [FATOR_ALTA]),
      fake("a_favor", true, [FATOR_ALTA]),
      fake("contra", true, [FATOR_BAIXA]),
      fake("contra", true, [FATOR_BAIXA]),
      fake("contra", true, [FATOR_BAIXA]),
    ]);
    const alta = r.find((x) => x.valor === "alta");
    const baixa = r.find((x) => x.valor === "baixa");
    expect(alta?.taxaAFavor).toBeCloseTo(1, 10);
    expect(baixa?.taxaAFavor).toBeCloseTo(0, 10);
  });

  it("uma decisão com múltiplos fatores conta para cada um", () => {
    const r = resumirFatores([
      fake("a_favor", true, [FATOR_ALTA, { chave: "carryFaixa", valor: "alta" }]),
      fake("a_favor", true, [FATOR_ALTA]),
      fake("a_favor", true, [FATOR_ALTA]),
    ]);
    const confluence = r.find((x) => x.chave === "confluenceConviccao");
    const carry = r.find((x) => x.chave === "carryFaixa");
    expect(confluence?.observacoes).toBe(3);
    expect(carry?.observacoes).toBe(1);
  });

  it("explicação nunca promete resultado futuro e nunca menciona alterar pesos", () => {
    const r = resumirFatores([
      fake("a_favor", true, [FATOR_ALTA]),
      fake("a_favor", true, [FATOR_ALTA]),
      fake("a_favor", true, [FATOR_ALTA]),
    ]);
    const texto = r[0].explicacao.toLowerCase();
    expect(texto).not.toMatch(/garantid|prometid|compre|venda|recomend/);
    expect(texto).toContain("nunca altera pesos");
  });
});
