import { describe, expect, it } from "vitest";
import { montarProveniencia } from "./proveniencia";
import { montarLinhagem, resumoLinhagem } from "./truth-lineage";

describe("montarLinhagem", () => {
  it("reaproveita montarProveniencia (Foundation congelado) e acrescenta indicador/tabela/motor", () => {
    const prov = montarProveniencia(
      { fonte: "CVM (DFP)", documento: "12345", data: "2026-06-30", versao: 1, payload: { x: 1 }, confiabilidade: "alta" },
      "2026-08-04T00:00:00.000Z"
    );
    const linhagem = montarLinhagem(prov, { indicador: "receita_liquida", tabela: "fundamentos", motorResponsavel: "tools/backfill_cvm.py" });
    expect(linhagem.fonte).toBe("CVM (DFP)"); // veio da proveniência, sem reimplementar
    expect(linhagem.linha).toBeNull(); // continua null, motivo já documentado em proveniencia.ts
    expect(linhagem.indicador).toBe("receita_liquida");
    expect(linhagem.tabela).toBe("fundamentos");
    expect(linhagem.motorResponsavel).toBe("tools/backfill_cvm.py");
  });
});

describe("resumoLinhagem", () => {
  it("monta uma linha de texto com fonte, documento, versão, tabela e motor", () => {
    const prov = montarProveniencia(
      { fonte: "CVM (DFP)", documento: "12345", data: "2026-06-30", versao: 1, payload: { x: 1 }, confiabilidade: "alta" },
      "2026-08-04T00:00:00.000Z"
    );
    const linhagem = montarLinhagem(prov, { indicador: "receita_liquida", tabela: "fundamentos", motorResponsavel: "tools/backfill_cvm.py" });
    const texto = resumoLinhagem(linhagem);
    expect(texto).toContain("CVM (DFP)");
    expect(texto).toContain("doc. 12345");
    expect(texto).toContain("v1");
    expect(texto).toContain("fundamentos");
    expect(texto).toContain("tools/backfill_cvm.py");
  });

  it("omite documento e versão quando ausentes, sem inventar", () => {
    const prov = montarProveniencia(
      { fonte: "BCB (Focus)", documento: null, data: "2026-07-31", versao: null, payload: { x: 1 }, confiabilidade: "alta" },
      "2026-08-04T00:00:00.000Z"
    );
    const linhagem = montarLinhagem(prov, { indicador: "selic_focus", tabela: "macro_focus", motorResponsavel: "tools/coleta_focus.py" });
    const texto = resumoLinhagem(linhagem);
    expect(texto).not.toContain("doc.");
    expect(texto).not.toContain("v null");
  });
});
