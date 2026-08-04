import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { montarProveniencia } from "./proveniencia";

describe("montarProveniencia", () => {
  it("linha e página são sempre null, com motivo explícito por escrito", () => {
    const p = montarProveniencia(
      { fonte: "CVM (ITR)", documento: "12345", data: "2026-06-30", versao: 1, payload: { a: 1 }, confiabilidade: "alta" },
      "2026-08-04T12:00:00Z"
    );
    expect(p.linha).toBeNull();
    expect(p.pagina).toBeNull();
    expect(p.motivoAusenciaLinhaPagina.length).toBeGreaterThan(20);
  });

  it("hash é SHA-256 determinístico do payload bruto", () => {
    const payload = { receita_liquida: 100, lucro_liquido: 20 };
    const esperado = createHash("sha256").update(JSON.stringify(payload)).digest("hex");
    const p = montarProveniencia(
      { fonte: "CVM (DFP)", documento: null, data: "2025-12-31", versao: 1, payload, confiabilidade: "alta" },
      "2026-08-04T12:00:00Z"
    );
    expect(p.hash).toBe(esperado);
  });

  it("payloads diferentes geram hashes diferentes (detecta alteração silenciosa)", () => {
    const a = montarProveniencia(
      { fonte: "brapi", documento: null, data: "2026-08-04", versao: 1, payload: { preco: 10 }, confiabilidade: "media" },
      "2026-08-04T12:00:00Z"
    );
    const b = montarProveniencia(
      { fonte: "brapi", documento: null, data: "2026-08-04", versao: 1, payload: { preco: 11 }, confiabilidade: "media" },
      "2026-08-04T12:00:00Z"
    );
    expect(a.hash).not.toBe(b.hash);
  });

  it("timestamp é sempre o injetado — nunca gerado internamente (determinismo)", () => {
    const p1 = montarProveniencia(
      { fonte: "brapi", documento: null, data: null, versao: null, payload: {}, confiabilidade: "baixa" },
      "2026-01-01T00:00:00Z"
    );
    const p2 = montarProveniencia(
      { fonte: "brapi", documento: null, data: null, versao: null, payload: {}, confiabilidade: "baixa" },
      "2026-01-01T00:00:00Z"
    );
    expect(p1).toEqual(p2);
    expect(p1.timestamp).toBe("2026-01-01T00:00:00Z");
  });

  it("payload ausente (null/undefined) não quebra — hash de null", () => {
    expect(() =>
      montarProveniencia(
        { fonte: "CVM (ITR)", documento: null, data: null, versao: null, payload: undefined, confiabilidade: "baixa" },
        "2026-01-01T00:00:00Z"
      )
    ).not.toThrow();
  });
});
