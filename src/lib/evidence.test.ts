import { describe, expect, it } from "vitest";
import { montarEvidencia, resumirEvidenciasPorTicker, CATEGORIAS_COM_FONTE_HOJE, type Evidencia } from "./evidence";

describe("montarEvidencia", () => {
  it("nasce sempre com status ativa e hash do payload", () => {
    const e = montarEvidencia(
      {
        ticker: "INTB3",
        categoria: "margem",
        origem: "CVM (ITR)",
        data: "2026-06-30",
        pesoInformativo: 0.5,
        confiabilidade: "alta",
        descricao: "Margem líquida subiu de 12% para 14%.",
        payload: { margem_liquida: 0.14 },
      },
      "2026-08-04T12:00:00Z"
    );
    expect(e.status).toBe("ativa");
    expect(e.hash).toHaveLength(64); // sha256 hex
    expect(e.timestamp).toBe("2026-08-04T12:00:00Z");
  });

  it("payloads diferentes geram hashes diferentes", () => {
    const base = {
      ticker: "INTB3",
      categoria: "roic" as const,
      origem: "CVM (ITR)",
      data: "2026-06-30",
      pesoInformativo: 0.3,
      confiabilidade: "alta" as const,
      descricao: "x",
    };
    const a = montarEvidencia({ ...base, payload: { roic: 0.2 } }, "2026-08-04T12:00:00Z");
    const b = montarEvidencia({ ...base, payload: { roic: 0.1 } }, "2026-08-04T12:00:00Z");
    expect(a.hash).not.toBe(b.hash);
  });
});

describe("CATEGORIAS_COM_FONTE_HOJE", () => {
  it("é um subconjunto documentado das categorias — corte honesto, nunca promete coleta que não existe", () => {
    expect(CATEGORIAS_COM_FONTE_HOJE.length).toBeGreaterThan(0);
    expect(CATEGORIAS_COM_FONTE_HOJE).not.toContain("insider_compra"); // sem coletor hoje
    expect(CATEGORIAS_COM_FONTE_HOJE).toContain("margem"); // já vem da CVM
  });
});

describe("resumirEvidenciasPorTicker", () => {
  const evidencias: Evidencia[] = [
    {
      ticker: "INTB3",
      categoria: "margem",
      origem: "CVM",
      data: "2026-06-30",
      pesoInformativo: 0.5,
      confiabilidade: "alta",
      descricao: "x",
      timestamp: "t",
      hash: "h1",
      status: "ativa",
    },
    {
      ticker: "INTB3",
      categoria: "roic",
      origem: "CVM",
      data: "2026-06-30",
      pesoInformativo: -0.2,
      confiabilidade: "media",
      descricao: "x",
      timestamp: "t",
      hash: "h2",
      status: "ativa",
    },
    {
      ticker: "INTB3",
      categoria: "margem",
      origem: "CVM",
      data: "2026-03-31",
      pesoInformativo: 0.9,
      confiabilidade: "alta",
      descricao: "x (evidência antiga, substituída pela mais recente)",
      timestamp: "t",
      hash: "h3",
      status: "supersedida",
    },
    {
      ticker: "WEGE3",
      categoria: "roic",
      origem: "CVM",
      data: "2026-06-30",
      pesoInformativo: 0.7,
      confiabilidade: "alta",
      descricao: "x",
      timestamp: "t",
      hash: "h4",
      status: "ativa",
    },
  ];

  it("só soma evidências ativas — supersedida/refutada não contam mais no agregado", () => {
    const r = resumirEvidenciasPorTicker("INTB3", evidencias);
    expect(r.total).toBe(3); // inclui a supersedida na contagem total
    expect(r.ativas).toBe(2); // mas só 2 estão ativas
    expect(r.somaPesoInformativoAtivas).toBeCloseTo(0.5 + -0.2, 10); // não soma a supersedida (0.9)
  });

  it("filtra por ticker corretamente", () => {
    const r = resumirEvidenciasPorTicker("WEGE3", evidencias);
    expect(r.total).toBe(1);
    expect(r.somaPesoInformativoAtivas).toBeCloseTo(0.7, 10);
  });

  it("ticker sem evidências: zeros, nunca quebra", () => {
    const r = resumirEvidenciasPorTicker("ZZZZ3", evidencias);
    expect(r.total).toBe(0);
    expect(r.ativas).toBe(0);
    expect(r.somaPesoInformativoAtivas).toBe(0);
  });

  it("porCategoria conta só as ativas", () => {
    const r = resumirEvidenciasPorTicker("INTB3", evidencias);
    expect(r.porCategoria.margem).toBe(1); // só a ativa, não a supersedida
    expect(r.porCategoria.roic).toBe(1);
  });
});
