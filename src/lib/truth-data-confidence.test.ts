import { describe, expect, it } from "vitest";
import { calcularDataConfidence, type EntradaDataConfidence } from "./truth-data-confidence";

const base: EntradaDataConfidence = {
  confiabilidadeFonte: "alta",
  idadeDias: 3,
  verificacoesFdie: [{ id: "x", nome: "x", severidade: "ok", mensagem: "ok" }],
  divergenciaConhecida: false,
  temLineage: true,
};

describe("calcularDataConfidence", () => {
  it("dá 5 estrelas quando todo sinal disponível é favorável", () => {
    const r = calcularDataConfidence(base);
    expect(r.estrelas).toBe(5);
  });

  it("nunca dá menos que 1 estrela, mesmo com tudo desfavorável", () => {
    const r = calcularDataConfidence({
      confiabilidadeFonte: "baixa",
      idadeDias: 200,
      verificacoesFdie: [{ id: "x", nome: "x", severidade: "critico", mensagem: "erro" }],
      divergenciaConhecida: true,
      temLineage: false,
    });
    expect(r.estrelas).toBe(1);
  });

  it("verificação crítica do FDIE trava a nota mesmo com o resto favorável", () => {
    const r = calcularDataConfidence({
      ...base,
      verificacoesFdie: [{ id: "x", nome: "x", severidade: "critico", mensagem: "erro" }],
    });
    expect(r.estrelas).toBeLessThan(5);
    expect(r.motivos.some((m) => m.includes("CRÍTICA"))).toBe(true);
  });

  it("alerta do FDIE trava a nota (não soma nem subtrai ponto extra)", () => {
    const r = calcularDataConfidence({
      ...base,
      verificacoesFdie: [{ id: "x", nome: "x", severidade: "alerta", mensagem: "aviso" }],
    });
    expect(r.motivos.some((m) => m.includes("alerta de integridade"))).toBe(true);
  });

  it("confiabilidade média soma menos que alta", () => {
    const alta = calcularDataConfidence({ ...base, confiabilidadeFonte: "alta" });
    const media = calcularDataConfidence({ ...base, confiabilidadeFonte: "media" });
    expect(media.estrelas).toBeLessThan(alta.estrelas);
  });

  it("idade desconhecida (null) não soma nem penaliza — nunca inventa", () => {
    const comIdade = calcularDataConfidence({ ...base, idadeDias: 3 });
    const semIdade = calcularDataConfidence({ ...base, idadeDias: null });
    expect(semIdade.estrelas).toBe(comIdade.estrelas - 1);
    expect(semIdade.motivos.some((m) => m.includes("desconhecida"))).toBe(true);
  });

  it("sem verificação FDIE aplicável não conta a favor nem contra, mas fica registrado", () => {
    const r = calcularDataConfidence({ ...base, verificacoesFdie: [] });
    expect(r.motivos.some((m) => m.includes("Nenhuma verificação de integridade aplicável"))).toBe(true);
  });

  it("divergência conhecida reduz a nota e nunca é confundida com 'confirmado'", () => {
    const semDivergencia = calcularDataConfidence(base);
    const comDivergencia = calcularDataConfidence({ ...base, divergenciaConhecida: true });
    expect(comDivergencia.estrelas).toBeLessThan(semDivergencia.estrelas);
  });

  it("sem lineage reduz a nota", () => {
    const comLineage = calcularDataConfidence(base);
    const semLineage = calcularDataConfidence({ ...base, temLineage: false });
    expect(semLineage.estrelas).toBeLessThan(comLineage.estrelas);
  });

  it("dados velhos (>90 dias) não recebem o ponto de atualização", () => {
    const r = calcularDataConfidence({ ...base, idadeDias: 120 });
    expect(r.motivos.some((m) => m.includes("mais de 90"))).toBe(true);
  });
});
