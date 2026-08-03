import { describe, expect, it } from "vitest";
import { corHeatmapRetorno } from "./heatmap";

describe("corHeatmapRetorno", () => {
  it("sem dado (null) retorna cor neutra, nunca verde/vermelho", () => {
    expect(corHeatmapRetorno(null)).toBe("rgba(148, 163, 184, 0.12)");
  });

  it("retorno positivo usa a paleta verde (emerald-400)", () => {
    const cor = corHeatmapRetorno(0.1);
    expect(cor.startsWith("rgba(52, 211, 153,")).toBe(true);
  });

  it("retorno negativo usa a paleta vermelha (red-400)", () => {
    const cor = corHeatmapRetorno(-0.1);
    expect(cor.startsWith("rgba(248, 113, 113,")).toBe(true);
  });

  it("retorno zero ainda é verde (>= 0), mas na intensidade mínima", () => {
    const cor = corHeatmapRetorno(0);
    expect(cor).toBe("rgba(52, 211, 153, 0.120)");
  });

  it("retorno igual à escala máxima satura na intensidade máxima", () => {
    const cor = corHeatmapRetorno(0.3, 0.3);
    expect(cor).toBe("rgba(52, 211, 153, 0.850)");
  });

  it("retorno além da escala máxima não passa da intensidade máxima (clamp)", () => {
    const cor = corHeatmapRetorno(5, 0.3);
    expect(cor).toBe("rgba(52, 211, 153, 0.850)");
  });

  it("retornos intermediários produzem intensidade proporcional", () => {
    const cor = corHeatmapRetorno(0.15, 0.3); // metade da escala
    expect(cor).toBe("rgba(52, 211, 153, 0.485)");
  });

  it("NaN/Infinity também caem no neutro (corte honesto)", () => {
    expect(corHeatmapRetorno(Number.NaN)).toBe("rgba(148, 163, 184, 0.12)");
    expect(corHeatmapRetorno(Number.POSITIVE_INFINITY)).toBe("rgba(148, 163, 184, 0.12)");
  });
});
