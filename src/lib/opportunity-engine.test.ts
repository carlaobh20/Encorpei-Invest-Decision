import { describe, expect, it } from "vitest";
import { avaliarOportunidade } from "./opportunity-engine";
import type { MudancaEvento } from "./market-scan-change-detection";

function mudancaPositiva(dimensao: MudancaEvento["dimensao"] = "carry"): MudancaEvento {
  return { ticker: "AAAA3", dimensao, disponivel: true, motivo: null, direcao: "melhorou", texto: "Melhorou." };
}

describe("avaliarOportunidade", () => {
  it("Confluence null: sem oportunidade", () => {
    expect(avaliarOportunidade({ ticker: "AAAA3", confluence: null, carry: 0.1, riscoTexto: null, fdieCritico: false, mudancasRecentes: [] })).toBeNull();
  });

  it("Confluence abaixo do piso: sem oportunidade", () => {
    expect(avaliarOportunidade({ ticker: "AAAA3", confluence: 40, carry: 0.1, riscoTexto: null, fdieCritico: false, mudancasRecentes: [] })).toBeNull();
  });

  it("Confluence na banda 'oportunidade': nível básico, sem exigir mais nada", () => {
    const r = avaliarOportunidade({ ticker: "AAAA3", confluence: 58, carry: null, riscoTexto: null, fdieCritico: false, mudancasRecentes: [] });
    expect(r?.nivel).toBe("oportunidade");
  });

  it("Confluence na banda 'rara' MAS sem Carry alto nem mudança positiva: rebaixado pra 'forte' — nunca só a nota", () => {
    const r = avaliarOportunidade({ ticker: "AAAA3", confluence: 90, carry: 0.03, riscoTexto: null, fdieCritico: false, mudancasRecentes: [] });
    expect(r?.nivel).toBe("forte");
  });

  it("Confluence na banda 'rara' COM Carry alto E mudança positiva: mantém 'rara'", () => {
    const r = avaliarOportunidade({ ticker: "AAAA3", confluence: 90, carry: 0.15, riscoTexto: null, fdieCritico: false, mudancasRecentes: [mudancaPositiva()] });
    expect(r?.nivel).toBe("rara");
  });

  it("FDIE crítico nunca deixa subir a 'rara'/'excepcional', mesmo com os outros sinais", () => {
    const r = avaliarOportunidade({ ticker: "AAAA3", confluence: 95, carry: 0.15, riscoTexto: null, fdieCritico: true, mudancasRecentes: [mudancaPositiva()] });
    expect(r?.nivel).toBe("boa");
    expect(r?.confianca).toBe("baixa");
  });

  it("sem mudanças disponíveis: oQueMudou explica a ausência, nunca inventa uma mudança", () => {
    const r = avaliarOportunidade({ ticker: "AAAA3", confluence: 60, carry: 0.05, riscoTexto: null, fdieCritico: false, mudancasRecentes: [] });
    expect(r?.oQueMudou).toContain("Nenhuma mudança");
  });

  it("mudanças negativas (piorou) não contam como sinal concordante pro nível mais alto", () => {
    const negativa: MudancaEvento = { ticker: "AAAA3", dimensao: "carry", disponivel: true, motivo: null, direcao: "piorou", texto: "Piorou." };
    const r = avaliarOportunidade({ ticker: "AAAA3", confluence: 90, carry: 0.15, riscoTexto: null, fdieCritico: false, mudancasRecentes: [negativa] });
    expect(r?.nivel).toBe("forte");
  });

  it("risco cai no texto padrão quando riscoTexto não é informado", () => {
    const r = avaliarOportunidade({ ticker: "AAAA3", confluence: 60, carry: null, riscoTexto: null, fdieCritico: false, mudancasRecentes: [] });
    expect(r?.risco.length).toBeGreaterThan(0);
  });
});
