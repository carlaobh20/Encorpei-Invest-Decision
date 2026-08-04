import { describe, expect, it } from "vitest";
import { montarSaudeCarteiraV2 } from "./dash-agregados";
import type { LinhaCarteira } from "./carteira";
import type { LinhaRadar } from "./radar";
import type { Decision } from "./decision-object";

function carteira(linhas: Array<{ ticker: string; peso: number; modelo?: string | null }>) {
  return linhas as unknown as LinhaCarteira[];
}

function decision(campos: { ticker: string; carry: number | null; confluence: number | null }): [string, Decision] {
  return [campos.ticker, campos as unknown as Decision];
}

describe("montarSaudeCarteiraV2", () => {
  it("usa Decision.carry (v2) em vez do carry do Radar (v1) na Saúde da Carteira", () => {
    const c = carteira([{ ticker: "WEGE3", peso: 1, modelo: "industrial" }]);
    const radar = [{ ticker: "WEGE3", carryReal: 0.05, roic4: 0.2, ey: 0.07 }] as unknown as LinhaRadar[];
    const decisions = new Map([decision({ ticker: "WEGE3", carry: 0.12, confluence: 70 })]);

    const r = montarSaudeCarteiraV2(c, radar, [], decisions, new Map());

    // 0.12 (Decision v2), nunca 0.05 (radar v1) — a Opção A pede exatamente essa divergência isolada no Meu Dash
    expect(r.saude.carryMedioPonderado).toBeCloseTo(0.12, 6);
  });

  it("ROIC/valuation continuam vindo do Radar (não fazem parte da divergência v1/v2)", () => {
    const c = carteira([{ ticker: "WEGE3", peso: 1, modelo: "industrial" }]);
    const radar = [{ ticker: "WEGE3", carryReal: 0.05, roic4: 0.22, ey: 0.09 }] as unknown as LinhaRadar[];
    const decisions = new Map([decision({ ticker: "WEGE3", carry: null, confluence: null })]);

    const r = montarSaudeCarteiraV2(c, radar, [], decisions, new Map());

    expect(r.saude.roicMedioPonderado).toBeCloseTo(0.22, 6);
    expect(r.saude.earningsYieldMedioPonderado).toBeCloseTo(0.09, 6);
  });

  it("Confluence v2 pondera pelo Decision.confluence, não pelo Confluence v1", () => {
    const c = carteira([
      { ticker: "A", peso: 0.5, modelo: null },
      { ticker: "B", peso: 0.5, modelo: null },
    ]);
    const decisions = new Map([
      decision({ ticker: "A", carry: null, confluence: 80 }),
      decision({ ticker: "B", carry: null, confluence: 60 }),
    ]);

    const r = montarSaudeCarteiraV2(c, [], [], decisions, new Map());

    expect(r.confluenceV2.valor).toBeCloseTo(70, 6);
  });

  it("ticker sem Decision correspondente: carry/confluence ficam null, sem quebrar nem inventar", () => {
    const c = carteira([{ ticker: "SEM_DECISION", peso: 1, modelo: null }]);
    const r = montarSaudeCarteiraV2(c, [], [], new Map(), new Map());
    expect(r.saude.carryMedioPonderado).toBeNull();
    expect(r.confluenceV2.valor).toBeNull();
  });

  it("Liquidez: média ponderada por peso do volume diário em R$", () => {
    const c = carteira([
      { ticker: "A", peso: 0.5, modelo: null },
      { ticker: "B", peso: 0.5, modelo: null },
    ]);
    const volumes = new Map([
      ["A", 20_000_000],
      ["B", 200_000],
    ]);
    const r = montarSaudeCarteiraV2(c, [], [], new Map(), volumes);
    expect(r.liquidez.valor).toBeCloseTo(10_100_000, 0);
    expect(r.liquidez.cobertura).toBe(2);
    expect(r.liquidez.total).toBe(2);
  });

  it("Liquidez: rótulos alta/média/baixa pelos limiares documentados", () => {
    const alta = montarSaudeCarteiraV2(carteira([{ ticker: "A", peso: 1, modelo: null }]), [], [], new Map(), new Map([["A", 15_000_000]]));
    const media = montarSaudeCarteiraV2(carteira([{ ticker: "A", peso: 1, modelo: null }]), [], [], new Map(), new Map([["A", 5_000_000]]));
    const baixa = montarSaudeCarteiraV2(carteira([{ ticker: "A", peso: 1, modelo: null }]), [], [], new Map(), new Map([["A", 500_000]]));
    expect(alta.liquidez.rotulo).toBe("alta");
    expect(media.liquidez.rotulo).toBe("media");
    expect(baixa.liquidez.rotulo).toBe("baixa");
  });

  it("sem nenhum volume disponível: liquidez null, cobertura zero — nunca inventa número", () => {
    const c = carteira([{ ticker: "A", peso: 1, modelo: null }]);
    const r = montarSaudeCarteiraV2(c, [], [], new Map(), new Map());
    expect(r.liquidez.valor).toBeNull();
    expect(r.liquidez.rotulo).toBeNull();
    expect(r.liquidez.cobertura).toBe(0);
  });

  it("growthIndisponivel sempre true — corte honesto sobre Decision.growth sem motor", () => {
    const c = carteira([{ ticker: "A", peso: 1, modelo: null }]);
    const r = montarSaudeCarteiraV2(c, [], [], new Map(), new Map());
    expect(r.growthIndisponivel).toBe(true);
  });
});
