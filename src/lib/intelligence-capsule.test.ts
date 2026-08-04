import { describe, expect, it } from "vitest";
import { montarIntelligenceCapsule } from "./intelligence-capsule";
import type { InvestmentStory } from "./investment-story-narrativa";

const STORY: InvestmentStory = {
  quemE: "Empresa X (TICK3) — Setor Y, Compounder.",
  porQueInteressante: "Confluence 80.",
  oQueFortalece: ["força 1"],
  oQueEnfraquece: ["fraqueza 1"],
  principalRisco: "risco principal",
  principalCatalisador: "catalisador principal",
  evidenciasUsadas: 0,
};

describe("montarIntelligenceCapsule", () => {
  it("resumo/oportunidade/risco vêm direto da InvestmentStory, sem reprocessar", () => {
    const r = montarIntelligenceCapsule({ story: STORY, fdie: { ok: 3, alerta: 0, critico: 0, total: 3 }, urgencia: "baixa", motivoUrgencia: "rotina" });
    expect(r.resumo).toBe(STORY.quemE);
    expect(r.porQueImporta).toBe(STORY.porQueInteressante);
    expect(r.maiorOportunidade).toBe(STORY.principalCatalisador);
    expect(r.maiorRisco).toBe(STORY.principalRisco);
  });

  it("FDIE com crítico vira nível de confiança baixa", () => {
    const r = montarIntelligenceCapsule({ story: STORY, fdie: { ok: 1, alerta: 0, critico: 1, total: 2 }, urgencia: "baixa", motivoUrgencia: "x" });
    expect(r.nivelConfianca).toBe("baixa");
  });

  it("FDIE com alerta (sem crítico) vira nível de confiança média", () => {
    const r = montarIntelligenceCapsule({ story: STORY, fdie: { ok: 2, alerta: 1, critico: 0, total: 3 }, urgencia: "baixa", motivoUrgencia: "x" });
    expect(r.nivelConfianca).toBe("media");
  });

  it("FDIE todo ok vira nível de confiança alta", () => {
    const r = montarIntelligenceCapsule({ story: STORY, fdie: { ok: 3, alerta: 0, critico: 0, total: 3 }, urgencia: "baixa", motivoUrgencia: "x" });
    expect(r.nivelConfianca).toBe("alta");
  });

  it("FDIE sem nenhuma verificação (total 0) é honesto: indisponível, não 'alta' por omissão", () => {
    const r = montarIntelligenceCapsule({ story: STORY, fdie: { ok: 0, alerta: 0, critico: 0, total: 0 }, urgencia: "baixa", motivoUrgencia: "x" });
    expect(r.nivelConfianca).toBe("indisponivel");
  });

  it("urgência crítica ou alta vira precisoAgir true; média/baixa vira false", () => {
    expect(montarIntelligenceCapsule({ story: STORY, fdie: { ok: 1, alerta: 0, critico: 0, total: 1 }, urgencia: "critica", motivoUrgencia: "m" }).precisoAgir).toBe(true);
    expect(montarIntelligenceCapsule({ story: STORY, fdie: { ok: 1, alerta: 0, critico: 0, total: 1 }, urgencia: "alta", motivoUrgencia: "m" }).precisoAgir).toBe(true);
    expect(montarIntelligenceCapsule({ story: STORY, fdie: { ok: 1, alerta: 0, critico: 0, total: 1 }, urgencia: "media", motivoUrgencia: "m" }).precisoAgir).toBe(false);
    expect(montarIntelligenceCapsule({ story: STORY, fdie: { ok: 1, alerta: 0, critico: 0, total: 1 }, urgencia: "baixa", motivoUrgencia: "m" }).precisoAgir).toBe(false);
  });
});
