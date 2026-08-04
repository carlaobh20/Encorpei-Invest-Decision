import { describe, expect, it } from "vitest";
import { bucketizarQuickActions } from "./quick-actions";
import type { DecisaoPrioritaria } from "./decisoes-prioritarias";

function d(urgencia: DecisaoPrioritaria["urgencia"], ticker: string): DecisaoPrioritaria {
  return {
    ticker,
    empresa: ticker,
    titulo: "x",
    urgencia,
    probabilidade: null,
    probabilidadeMotivo: null,
    impactoEsperado: "x",
    tempoEstimadoMinutos: 5,
    motivo: "x",
    acao: "Revisar",
  };
}

describe("bucketizarQuickActions", () => {
  it("crítica vai pro balde 'hoje'", () => {
    const r = bucketizarQuickActions([d("critica", "A3")]);
    expect(r.hoje.map((x) => x.ticker)).toEqual(["A3"]);
  });

  it("alta vai pro balde 'esta_semana'", () => {
    const r = bucketizarQuickActions([d("alta", "B3")]);
    expect(r.esta_semana.map((x) => x.ticker)).toEqual(["B3"]);
  });

  it("média vai pro balde 'este_mes'", () => {
    const r = bucketizarQuickActions([d("media", "C3")]);
    expect(r.este_mes.map((x) => x.ticker)).toEqual(["C3"]);
  });

  it("baixa não entra em nenhum balde — rotina não é fila de trabalho", () => {
    const r = bucketizarQuickActions([d("baixa", "D3")]);
    expect(r.hoje).toEqual([]);
    expect(r.esta_semana).toEqual([]);
    expect(r.este_mes).toEqual([]);
  });

  it("lista vazia devolve os 3 baldes vazios, nunca undefined", () => {
    const r = bucketizarQuickActions([]);
    expect(r).toEqual({ hoje: [], esta_semana: [], este_mes: [] });
  });

  it("mistura de urgências distribui corretamente entre os baldes", () => {
    const r = bucketizarQuickActions([d("critica", "A3"), d("alta", "B3"), d("media", "C3"), d("baixa", "D3")]);
    expect(r.hoje).toHaveLength(1);
    expect(r.esta_semana).toHaveLength(1);
    expect(r.este_mes).toHaveLength(1);
  });
});
