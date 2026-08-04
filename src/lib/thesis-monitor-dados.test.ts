import { describe, expect, it } from "vitest";
import { montarThesisMonitor, classificarTendenciaNota } from "./thesis-monitor-dados";

describe("montarThesisMonitor", () => {
  it("inclui ticker cuja nota subiu acima do limiar", () => {
    const r = montarThesisMonitor([{ ticker: "TIMS3", empresa: "TIM", notaAnterior: 60, notaAtual: 70 }]);
    expect(r).toHaveLength(1);
    expect(r[0].tendencia).toBe("subindo");
    expect(r[0].diff).toBe(10);
  });

  it("inclui ticker cuja nota caiu acima do limiar", () => {
    const r = montarThesisMonitor([{ ticker: "BBAS3", empresa: "Banco do Brasil", notaAnterior: 70, notaAtual: 60 }]);
    expect(r[0].tendencia).toBe("descendo");
  });

  it("exclui ticker cuja nota não mudou o suficiente — nunca lista tudo", () => {
    const r = montarThesisMonitor([{ ticker: "PORT3", empresa: "Porto", notaAnterior: 70, notaAtual: 72 }]);
    expect(r).toHaveLength(0);
  });

  it("exclui ticker sem par de notas (anterior ou atual null) — nunca inventa tendência", () => {
    const r = montarThesisMonitor([{ ticker: "INTB3", empresa: "Intelbras", notaAnterior: null, notaAtual: 80 }]);
    expect(r).toHaveLength(0);
  });

  it("ordena por magnitude da mudança, maior primeiro", () => {
    const r = montarThesisMonitor([
      { ticker: "A", empresa: "A", notaAnterior: 50, notaAtual: 56 },
      { ticker: "B", empresa: "B", notaAnterior: 50, notaAtual: 70 },
    ]);
    expect(r.map((l) => l.ticker)).toEqual(["B", "A"]);
  });
});

describe("classificarTendenciaNota", () => {
  it("diferente de montarThesisMonitor, SEMPRE retorna algo — 'estavel' também é resposta válida", () => {
    expect(classificarTendenciaNota(70, 71)).toBe("estavel");
  });

  it("subindo/descendo acima do limiar", () => {
    expect(classificarTendenciaNota(60, 70)).toBe("subindo");
    expect(classificarTendenciaNota(70, 60)).toBe("descendo");
  });

  it("null quando falta um dos dois pontos — nunca inventa tendência", () => {
    expect(classificarTendenciaNota(null, 70)).toBeNull();
    expect(classificarTendenciaNota(70, null)).toBeNull();
  });
});
