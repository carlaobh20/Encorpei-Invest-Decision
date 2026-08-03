import { describe, expect, it } from "vitest";
import { calcularSaudeCarteira, confluenciaMediaPonderada, montarLinhasSaude, type LinhaSaude } from "./portfolio-health";
import type { LinhaCarteira } from "./carteira";
import type { LinhaRadar } from "./radar";
import type { LinhaCompounder } from "./compounder-dados";

describe("calcularSaudeCarteira", () => {
  it("carteira igualmente distribuída em 4 papéis: HHI = 0.25 (limite), rótulo alta", () => {
    const linhas: LinhaSaude[] = ["A", "B", "C", "D"].map((t) => ({
      ticker: t,
      peso: 0.25,
      modelo: "industrial",
      carryReal: 0.08,
      roic4: 0.15,
      earningsYield: 0.1,
      sensibilidadeSelic: "media",
    }));
    const r = calcularSaudeCarteira(linhas);
    expect(r.concentracaoHHI).toBeCloseTo(0.25, 6);
    expect(r.concentracaoRotulo).toBe("alta");
    expect(r.carryMedioPonderado).toBeCloseTo(0.08, 6);
  });

  it("uma posição concentra 80% da carteira: rótulo muito_alta e maiorPosicao correta", () => {
    const linhas: LinhaSaude[] = [
      { ticker: "WEGE3", peso: 0.8, modelo: "industrial", carryReal: 0.1, roic4: 0.2, earningsYield: 0.08, sensibilidadeSelic: "baixa" },
      { ticker: "ITUB4", peso: 0.2, modelo: "banco", carryReal: 0.09, roic4: null, earningsYield: 0.11, sensibilidadeSelic: null },
    ];
    const r = calcularSaudeCarteira(linhas);
    expect(r.concentracaoRotulo).toBe("muito_alta");
    expect(r.maiorPosicao).toEqual({ ticker: "WEGE3", peso: 0.8 });
  });

  it("ROIC de banco (null, pós-correção do Sector Intelligence) não contamina a média — só pondera quem tem dado", () => {
    const linhas: LinhaSaude[] = [
      { ticker: "WEGE3", peso: 0.5, modelo: "industrial", carryReal: 0.1, roic4: 0.2, earningsYield: 0.08, sensibilidadeSelic: "media" },
      { ticker: "ITUB4", peso: 0.5, modelo: "banco", carryReal: 0.09, roic4: null, earningsYield: 0.11, sensibilidadeSelic: null },
    ];
    const r = calcularSaudeCarteira(linhas);
    // só WEGE3 tem ROIC, então a média ponderada = 0.2 (não faz média com null)
    expect(r.roicMedioPonderado).toBeCloseTo(0.2, 6);
    expect(r.cobertura.roic).toBe(1);
    expect(r.cobertura.total).toBe(2);
  });

  it("nenhuma posição com sensibilidade calculável: categoria null com motivo explicado", () => {
    const linhas: LinhaSaude[] = [
      { ticker: "X", peso: 1, modelo: null, carryReal: null, roic4: null, earningsYield: null, sensibilidadeSelic: null },
    ];
    const r = calcularSaudeCarteira(linhas);
    expect(r.sensibilidadeSelicMedia.categoria).toBeNull();
    expect(r.sensibilidadeSelicMedia.explicacao).toMatch(/Sem dado/);
  });

  it("alocação por modelo soma ~1 e agrupa por rótulo", () => {
    const linhas: LinhaSaude[] = [
      { ticker: "A", peso: 0.6, modelo: "industrial", carryReal: null, roic4: null, earningsYield: null, sensibilidadeSelic: null },
      { ticker: "B", peso: 0.4, modelo: "industrial", carryReal: null, roic4: null, earningsYield: null, sensibilidadeSelic: null },
    ];
    const r = calcularSaudeCarteira(linhas);
    expect(r.alocacaoPorModelo).toEqual([{ rotulo: "industrial", pct: 1 }]);
  });
});

describe("montarLinhasSaude", () => {
  it("junta peso/modelo da carteira com carry/ROIC/EY do Radar e sensibilidade do Compounder", () => {
    const carteira = [
      { ticker: "WEGE3", peso: 0.6, modelo: "industrial" },
      { ticker: "ITUB4", peso: 0.4, modelo: "banco" },
    ] as unknown as LinhaCarteira[];
    const radar = [
      { ticker: "WEGE3", carryReal: 0.09, roic4: 0.22, ey: 0.07 },
      { ticker: "ITUB4", carryReal: 0.11, roic4: null, ey: 0.15 },
    ] as unknown as LinhaRadar[];
    const compounder = [
      { ticker: "WEGE3", sensibilidadeSelic: { categoria: "baixa", explicacao: "x" } },
    ] as unknown as LinhaCompounder[];

    const linhas = montarLinhasSaude(carteira, radar, compounder);
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toEqual({
      ticker: "WEGE3",
      peso: 0.6,
      modelo: "Industrial",
      carryReal: 0.09,
      roic4: 0.22,
      earningsYield: 0.07,
      sensibilidadeSelic: "baixa",
    });
    // ITUB4 não tem entrada no Compounder acima → sensibilidade fica null, nunca inventada
    expect(linhas[1].sensibilidadeSelic).toBeNull();
    expect(linhas[1].roic4).toBeNull();
  });

  it("descarta posições sem peso calculável (peso null) — corte honesto", () => {
    const carteira = [
      { ticker: "SEM_PRECO", peso: null, modelo: null },
    ] as unknown as LinhaCarteira[];
    const linhas = montarLinhasSaude(carteira, [], []);
    expect(linhas).toHaveLength(0);
  });
});

describe("confluenciaMediaPonderada", () => {
  it("pondera pelo peso quando todas as posições têm Confluence Score", () => {
    const r = confluenciaMediaPonderada([
      { peso: 0.6, score: 80 },
      { peso: 0.4, score: 50 },
    ]);
    expect(r.valor).toBeCloseTo(68, 6); // 0.6*80 + 0.4*50
    expect(r.cobertura).toBe(2);
    expect(r.total).toBe(2);
  });

  it("ignora posições sem score, mas reporta a cobertura real", () => {
    const r = confluenciaMediaPonderada([
      { peso: 0.5, score: 90 },
      { peso: 0.5, score: null },
    ]);
    expect(r.valor).toBeCloseTo(90, 6); // só a posição com score entra, renormalizado
    expect(r.cobertura).toBe(1);
    expect(r.total).toBe(2);
  });

  it("nenhuma posição com score: valor null, cobertura zero", () => {
    const r = confluenciaMediaPonderada([{ peso: 1, score: null }]);
    expect(r.valor).toBeNull();
    expect(r.cobertura).toBe(0);
    expect(r.total).toBe(1);
  });

  it("lista vazia: valor null, total zero", () => {
    const r = confluenciaMediaPonderada([]);
    expect(r.valor).toBeNull();
    expect(r.total).toBe(0);
  });
});
