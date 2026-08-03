import { describe, expect, it } from "vitest";
import { calcularTechnical } from "./v1";
import type { TechnicalEntrada } from "./types";

/** Gera uma série de candles sintéticos (oldest→newest) com viés de alta/baixa. */
function gerarSerie(
  n: number,
  opts: { vies?: "alta" | "baixa" | "lateral"; volumeBase?: number; comBreakout?: "alta" | "baixa" } = {}
): TechnicalEntrada {
  const { vies = "alta", volumeBase = 1000, comBreakout } = opts;
  const closes: number[] = [];
  const maximas: number[] = [];
  const minimas: number[] = [];
  const volumes: number[] = [];
  let preco = 100;
  for (let i = 0; i < n; i++) {
    // drift pequeno + oscilação de amplitude maior que o drift: garante
    // topos/fundos reais (pivots) mesmo com viés de alta/baixa no total.
    if (vies === "alta") preco += 0.15 + Math.sin(i / 5) * 1.2;
    else if (vies === "baixa") preco -= 0.15 + Math.sin(i / 5) * 1.2;
    else preco += Math.sin(i / 3) * 1.5;
    if (comBreakout && i === n - 1) {
      preco = comBreakout === "alta" ? preco + 8 : preco - 8;
    }
    closes.push(preco);
    maximas.push(preco + 0.6);
    minimas.push(preco - 0.6);
    volumes.push(i === n - 1 && comBreakout ? volumeBase * 2.5 : volumeBase + (i % 7) * 20);
  }
  return { ticker: "TESTE3", closes, maximas, minimas, volumes, temTese: true };
}

describe("calcularTechnical", () => {
  it("score alto e timing favorável numa série de alta consistente e longa", () => {
    const e = gerarSerie(120, { vies: "alta" });
    const r = calcularTechnical(e);
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeGreaterThan(55);
    expect(r.componentesDisponiveis).toBeGreaterThanOrEqual(4);
    expect(r.timing).not.toBeNull();
  });

  it("score baixo numa série de baixa consistente e longa", () => {
    const e = gerarSerie(120, { vies: "baixa" });
    const r = calcularTechnical(e);
    expect(r.score).not.toBeNull();
    expect(r.score!).toBeLessThan(45);
  });

  it("com dado curto (poucos pregões), componentes de tendência/estrutura ficam nulos e não travam o score", () => {
    const e = gerarSerie(10, { vies: "alta" });
    const r = calcularTechnical(e);
    // com só 10 candles não há MM21 nem 4 pivots confirmados
    const tend = r.componentes.find((c) => c.id === "tendencia")!;
    const estr = r.componentes.find((c) => c.id === "estrutura")!;
    expect(tend.valor).toBeNull();
    expect(estr.valor).toBeNull();
    expect(r.confianca).toBe("baixa");
  });

  it("nunca usa a palavra 'compre' ou 'venda' na frase de timing", () => {
    const e = gerarSerie(120, { vies: "alta" });
    const r = calcularTechnical(e);
    expect(r.fraseTiming?.toLowerCase()).not.toMatch(/compr|vend/);
    expect(r.explicacaoTese.toLowerCase()).not.toMatch(/\bcompre\b|\bvenda\b/);
  });

  it("teseTecnica é 'sem_tese' quando não há tese registrada, mesmo com score disponível", () => {
    const e = { ...gerarSerie(120, { vies: "alta" }), temTese: false };
    const r = calcularTechnical(e);
    expect(r.teseTecnica).toBe("sem_tese");
  });

  it("detecta rompimento de resistência com confirmação de volume no componente de rompimentos", () => {
    const e = gerarSerie(60, { vies: "lateral", comBreakout: "alta" });
    const r = calcularTechnical(e);
    const romp = r.componentes.find((c) => c.id === "rompimentos")!;
    expect(romp.valor).not.toBeNull();
    expect(romp.valor!).toBeGreaterThan(60);
  });

  it("ATR e Bollinger vêm preenchidos como informativos quando há dado (fora do score)", () => {
    const e = gerarSerie(60, { vies: "alta" });
    const r = calcularTechnical(e);
    expect(r.atr14).not.toBeNull();
    expect(r.bollinger).not.toBeNull();
  });

  it("score null e confiança baixa quando não há dado nenhum (série mínima)", () => {
    const e: TechnicalEntrada = {
      ticker: "VAZIO3",
      closes: [10, 10.1, 9.9],
      maximas: [10.1, 10.2, 10],
      minimas: [9.9, 10, 9.8],
      volumes: [100, 100, 100],
      temTese: false,
    };
    const r = calcularTechnical(e);
    expect(r.score).toBeNull();
    expect(r.confianca).toBe("baixa");
    expect(r.timing).toBeNull();
  });
});
