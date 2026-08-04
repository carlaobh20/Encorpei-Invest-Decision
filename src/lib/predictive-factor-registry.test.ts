import { describe, expect, it } from "vitest";
import {
  REGISTRO_FATORES_PREDITIVOS,
  buscarFator,
  listarFatoresPorStatus,
  contarFatoresPorStatus,
  fatoresSemLimitacoesDocumentadas,
} from "./predictive-factor-registry";

describe("REGISTRO_FATORES_PREDITIVOS", () => {
  it("todo fator tem id único", () => {
    const ids = REGISTRO_FATORES_PREDITIVOS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todo fator documenta descrição, objetivo, origem e limitações — nunca campo vazio", () => {
    for (const f of REGISTRO_FATORES_PREDITIVOS) {
      expect(f.descricao.trim().length).toBeGreaterThan(0);
      expect(f.objetivo.trim().length).toBeGreaterThan(0);
      expect(f.origem.trim().length).toBeGreaterThan(0);
      expect(f.limitacoes.trim().length).toBeGreaterThan(0);
    }
  });

  it("todo fator tem status válido", () => {
    for (const f of REGISTRO_FATORES_PREDITIVOS) {
      expect(["ativo", "experimental", "descartado"]).toContain(f.status);
    }
  });
});

describe("buscarFator", () => {
  it("encontra fator existente por id", () => {
    const f = buscarFator("confluence_quality");
    expect(f).not.toBeNull();
    expect(f!.nome).toContain("Quality");
  });

  it("id inexistente retorna null, nunca lança erro", () => {
    expect(buscarFator("nao_existe")).toBeNull();
  });
});

describe("listarFatoresPorStatus / contarFatoresPorStatus", () => {
  it("listarFatoresPorStatus só retorna fatores do status pedido", () => {
    const experimentais = listarFatoresPorStatus("experimental");
    expect(experimentais.length).toBeGreaterThan(0);
    expect(experimentais.every((f) => f.status === "experimental")).toBe(true);
  });

  it("contarFatoresPorStatus soma exatamente o total do registro", () => {
    const contagem = contarFatoresPorStatus();
    const soma = contagem.ativo + contagem.experimental + contagem.descartado;
    expect(soma).toBe(REGISTRO_FATORES_PREDITIVOS.length);
  });

  it("nenhum fator descartado hoje — registro só começou neste sprint", () => {
    expect(contarFatoresPorStatus().descartado).toBe(0);
  });
});

describe("fatoresSemLimitacoesDocumentadas", () => {
  it("lista vazia hoje — todo fator do registro já documenta sua limitação", () => {
    expect(fatoresSemLimitacoesDocumentadas()).toEqual([]);
  });
});
