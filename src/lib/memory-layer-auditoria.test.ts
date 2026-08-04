import { describe, expect, it } from "vitest";
import { resumirAuditoriaMemoria, resumirLogsColeta, type LinhaEvidenciaAuditoria, type LinhaLogColeta } from "./memory-layer-auditoria";

describe("resumirAuditoriaMemoria", () => {
  const linhas: LinhaEvidenciaAuditoria[] = [
    { ticker: "PETR4", categoria: "receita", origem: "CVM (DFP/ITR)", confiabilidade: "alta", status: "ativa", data: "2026-07-20" },
    { ticker: "PETR4", categoria: "outro", origem: "CVM (IPE)", confiabilidade: "alta", status: "ativa", data: "2026-06-01" },
    { ticker: "VALE3", categoria: "receita", origem: "CVM (DFP/ITR)", confiabilidade: "alta", status: "supersedida", data: "2026-07-25" },
  ];

  it("conta total, ativas e agrupa por empresa/categoria/origem/confiabilidade", () => {
    const r = resumirAuditoriaMemoria(linhas, "2026-08-04T00:00:00.000Z");
    expect(r.total).toBe(3);
    expect(r.ativas).toBe(2);
    expect(r.porEmpresa).toEqual([{ ticker: "PETR4", total: 2 }, { ticker: "VALE3", total: 1 }]);
    expect(r.porCategoria.find((c) => c.categoria === "receita")?.total).toBe(2);
  });

  it("conta só o que caiu nos últimos 30 dias, sem inventar janela maior", () => {
    const r = resumirAuditoriaMemoria(linhas, "2026-08-04T00:00:00.000Z");
    // corte = 2026-07-05; só os dois de julho (20 e 25) entram, o de junho (01) fica de fora
    expect(r.ultimos30dias).toBe(2);
  });
});

describe("resumirLogsColeta", () => {
  it("agrega execuções por coletor e mantém a mais recente", () => {
    const logs: LinhaLogColeta[] = [
      { coletor: "comunicados_ipe", criadoEm: "2026-08-01T07:00:00.000Z", quantidadeNovas: 5, quantidadeIgnoradasDuplicadas: 2, quantidadeErros: 0 },
      { coletor: "comunicados_ipe", criadoEm: "2026-08-02T07:00:00.000Z", quantidadeNovas: 3, quantidadeIgnoradasDuplicadas: 1, quantidadeErros: 1 },
    ];
    const r = resumirLogsColeta(logs);
    expect(r.execucoesTotal).toBe(2);
    expect(r.novasTotal).toBe(8);
    expect(r.duplicadasTotal).toBe(3);
    expect(r.errosTotal).toBe(1);
    expect(r.porColetor[0].ultimaExecucao).toBe("2026-08-02T07:00:00.000Z");
  });
});
