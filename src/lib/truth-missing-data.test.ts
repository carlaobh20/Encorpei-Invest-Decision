import { describe, expect, it } from "vitest";
import { LACUNAS_CONHECIDAS, lacunasPorCategoria, lacunasPorTela, resumirLacunas } from "./truth-missing-data";

describe("registro de lacunas", () => {
  it("toda lacuna tem motivo e dependeDe preenchidos — nunca só 'dado indisponível'", () => {
    for (const l of LACUNAS_CONHECIDAS) {
      expect(l.motivo.length).toBeGreaterThan(10);
      expect(l.dependeDe.length).toBeGreaterThan(5);
      expect(l.telasAfetadas.length).toBeGreaterThan(0);
    }
  });

  it("todo id é único — evita duas entradas conflitantes pro mesmo dado", () => {
    const ids = LACUNAS_CONHECIDAS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("lacunasPorCategoria", () => {
  it("filtra corretamente por categoria", () => {
    const r = lacunasPorCategoria("decisao_pendente");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((l) => l.categoria === "decisao_pendente")).toBe(true);
  });
});

describe("lacunasPorTela", () => {
  it("encontra lacunas que afetam uma tela específica", () => {
    const r = lacunasPorTela("/tese/[ticker]");
    expect(r.length).toBeGreaterThan(0);
  });

  it("devolve vazio para tela sem lacuna registrada", () => {
    const r = lacunasPorTela("/tela-que-nao-existe");
    expect(r).toHaveLength(0);
  });
});

describe("resumirLacunas", () => {
  it("soma total e agrupa por categoria batendo com o total", () => {
    const r = resumirLacunas();
    const somaCategorias = Object.values(r.porCategoria).reduce((a, b) => a + b, 0);
    expect(somaCategorias).toBe(r.total);
    expect(r.total).toBe(LACUNAS_CONHECIDAS.length);
  });

  it("conta corretamente quantas lacunas não têm sprint definida", () => {
    const r = resumirLacunas();
    const esperado = LACUNAS_CONHECIDAS.filter((l) => l.sprint === null).length;
    expect(r.semSprintDefinida).toBe(esperado);
  });
});
