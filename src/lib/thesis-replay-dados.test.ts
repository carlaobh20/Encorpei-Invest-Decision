import { describe, expect, it } from "vitest";
import { montarThesisReplay } from "./thesis-replay-dados";

const BASE = {
  competenciasAscendente: [],
  notasAscendente: [],
  carryAscendente: [],
  eventosTese: [],
  versoesTese: [],
  decisoesAvaliadas: [],
};

describe("montarThesisReplay", () => {
  it("gera 1 evento por transição de balanço, não só a última", () => {
    const r = montarThesisReplay("WEGE3", {
      ...BASE,
      competenciasAscendente: [{ competencia: "2025-06-30" }, { competencia: "2025-09-30" }, { competencia: "2025-12-31" }],
    });
    expect(r.filter((e) => e.tipo === "novo_balanco")).toHaveLength(2);
  });

  it("mudança de Carry usa a série real de carry_score, rotulada como v1 histórico", () => {
    const r = montarThesisReplay("WEGE3", {
      ...BASE,
      carryAscendente: [{ data: "2026-07-01", carryReal: 0.05 }, { data: "2026-08-01", carryReal: 0.09 }],
    });
    expect(r).toHaveLength(1);
    expect(r[0].explicacao).toMatch(/Carry v1, histórico oficial/);
  });

  it("nunca gera evento de mudança de controlador ou de Confluence — sem fonte de dado", () => {
    const r = montarThesisReplay("WEGE3", BASE);
    expect(r.map((e) => e.tipo)).not.toContain("mudanca_controlador");
    expect(r.map((e) => e.tipo)).not.toContain("mudanca_confluence");
  });

  it("ordena do mais recente para o mais antigo, misturando todos os tipos", () => {
    const r = montarThesisReplay("WEGE3", {
      ...BASE,
      eventosTese: [{ tipo: "criacao", explicacao: "x", criadoEm: "2026-01-01T00:00:00Z" }],
      versoesTese: [{ versao: 2, status: "valida", criadoEm: "2026-06-01T00:00:00Z" }],
    });
    expect(r[0].tipo).toBe("nova_versao_tese");
    expect(r[1].tipo).toBe("evento_tese");
  });

  it("só versões > 1 viram evento — v1 é a criação, já coberta por eventos_tese", () => {
    const r = montarThesisReplay("WEGE3", { ...BASE, versoesTese: [{ versao: 1, status: "valida", criadoEm: "2026-01-01T00:00:00Z" }] });
    expect(r).toHaveLength(0);
  });
});
