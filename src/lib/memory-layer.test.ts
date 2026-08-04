import { describe, expect, it } from "vitest";
import { filtrarEvidenciasNovas, montarEvidenciaEnriquecida, montarLogColeta, type ChaveDedupEvidencia } from "./memory-layer";

const candidataBase = {
  ticker: "PETR4",
  categoria: "outro" as const,
  origem: "CVM (IPE)",
  data: "2026-08-01",
  pesoInformativo: 0,
  confiabilidade: "alta" as const,
  descricao: "Fato relevante X",
  payload: { a: 1 },
  subcategoria: "Estratégico",
  titulo: "Fato relevante X",
  urlOficial: null,
  documentoOficial: "123456",
};

describe("montarEvidenciaEnriquecida", () => {
  it("reaproveita montarEvidencia (Foundation congelado) e acrescenta os campos de exibição", () => {
    const e = montarEvidenciaEnriquecida(candidataBase, "2026-08-01T00:00:00.000Z");
    expect(e.ticker).toBe("PETR4");
    expect(e.status).toBe("ativa"); // vem de montarEvidencia, nunca reimplementado aqui
    expect(e.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(e.subcategoria).toBe("Estratégico");
    expect(e.urlOficial).toBeNull();
  });
});

describe("filtrarEvidenciasNovas", () => {
  it("mantém candidata que não existe ainda", () => {
    const r = filtrarEvidenciasNovas([{ ...candidataBase, hash: "h1" }], []);
    expect(r).toHaveLength(1);
  });

  it("descarta candidata cuja chave ticker+categoria+origem+data+hash já existe", () => {
    const existentes: ChaveDedupEvidencia[] = [
      { ticker: "PETR4", categoria: "outro", origem: "CVM (IPE)", data: "2026-08-01", hash: "h1" },
    ];
    const r = filtrarEvidenciasNovas([{ ...candidataBase, hash: "h1" }], existentes);
    expect(r).toHaveLength(0);
  });

  it("mantém candidata com mesmo ticker/data mas categoria ou origem diferente — chave é composta, não só ticker+data", () => {
    const existentes: ChaveDedupEvidencia[] = [
      { ticker: "PETR4", categoria: "outro", origem: "CVM (IPE)", data: "2026-08-01", hash: "h1" },
    ];
    const r = filtrarEvidenciasNovas([{ ...candidataBase, hash: "h1", origem: "BCB (Focus)" }], existentes);
    expect(r).toHaveLength(1);
  });

  it("deduplica dentro do próprio lote candidato — dois coletores não podem gerar a mesma linha duas vezes na mesma leva", () => {
    const r = filtrarEvidenciasNovas(
      [
        { ...candidataBase, hash: "h1" },
        { ...candidataBase, hash: "h1" },
      ],
      []
    );
    expect(r).toHaveLength(1);
  });
});

describe("montarLogColeta", () => {
  it("calcula duplicadas como candidatas menos novas", () => {
    const log = montarLogColeta({
      coletor: "comunicados_ipe",
      iniciadoEm: "2026-08-01T07:00:00.000Z",
      concluidoEm: "2026-08-01T07:00:05.000Z",
      candidatas: 10,
      novas: 6,
    });
    expect(log.quantidadeNovas).toBe(6);
    expect(log.quantidadeIgnoradasDuplicadas).toBe(4);
    expect(log.quantidadeErros).toBe(0);
  });
});
