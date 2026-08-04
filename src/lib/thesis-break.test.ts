import { describe, expect, it } from "vitest";
import { identificarMotivosQuebra, type GatilhoEntrada } from "./thesis-break";

describe("identificarMotivosQuebra", () => {
  it("só gatilhos ATIVOS e de direção NEGATIVA viram motivo de quebra", () => {
    const gatilhos: GatilhoEntrada[] = [
      { descricao: "ROIC abaixo de 12%", direcao: "negativo", ativo: true },
      { descricao: "Queda de preço > 15% em 30 dias", direcao: "positivo", ativo: true }, // oportunidade, não quebra
      { descricao: "Margem abaixo de 8% (gatilho desativado)", direcao: "negativo", ativo: false },
    ];
    const motivos = identificarMotivosQuebra(gatilhos);
    const doGatilho = motivos.filter((m) => m.fonte === "gatilho");
    expect(doGatilho).toHaveLength(1);
    expect(doGatilho[0].descricao).toBe("ROIC abaixo de 12%");
    expect(doGatilho[0].monitorado).toBe(true);
  });

  it("sempre inclui a watchlist de controlador/fluxo — sem coletor hoje, marcada como não monitorada", () => {
    const motivos = identificarMotivosQuebra([]);
    const watchlist = motivos.filter((m) => m.fonte === "evidencia_pendente");
    expect(watchlist.length).toBeGreaterThanOrEqual(2);
    expect(watchlist.every((m) => m.monitorado === false)).toBe(true);
    expect(watchlist.some((m) => m.descricao.toLowerCase().includes("controlador"))).toBe(true);
    expect(watchlist.some((m) => m.descricao.toLowerCase().includes("fluxo"))).toBe(true);
  });

  it("sem nenhum gatilho negativo: ainda retorna a watchlist, nunca lista vazia", () => {
    const motivos = identificarMotivosQuebra([{ descricao: "x", direcao: "positivo", ativo: true }]);
    expect(motivos.length).toBeGreaterThan(0);
    expect(motivos.every((m) => m.fonte === "evidencia_pendente")).toBe(true);
  });
});
