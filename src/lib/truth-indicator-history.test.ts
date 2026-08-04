import { describe, expect, it } from "vitest";
import {
  COBERTURA_INDICADORES,
  indicadoresComHistorico,
  indicadoresSemHistorico,
  resumirCoberturaHistorico,
} from "./truth-indicator-history";

describe("registro de cobertura de histórico", () => {
  it("todo indicador sem histórico tem motivo preenchido — nunca só 'sem histórico'", () => {
    for (const i of indicadoresSemHistorico()) {
      expect(i.motivoAusencia).not.toBeNull();
      expect(i.motivoAusencia!.length).toBeGreaterThan(10);
      expect(i.tabela).toBeNull();
    }
  });

  it("todo indicador com histórico aponta a tabela e a frequência real", () => {
    for (const i of indicadoresComHistorico()) {
      expect(i.tabela).not.toBeNull();
      expect(i.frequencia).not.toBeNull();
      expect(i.motivoAusencia).toBeNull();
    }
  });

  it("carry e nota oficial têm histórico diário real", () => {
    const carry = COBERTURA_INDICADORES.find((i) => i.indicador === "carry");
    expect(carry?.temHistoricoPersistido).toBe(true);
    expect(carry?.frequencia).toBe("diária");
  });

  it("confluence não tem histórico — mesmo achado documentado na Memory Layer", () => {
    const confluence = COBERTURA_INDICADORES.find((i) => i.indicador === "confluence");
    expect(confluence?.temHistoricoPersistido).toBe(false);
  });
});

describe("resumirCoberturaHistorico", () => {
  it("soma comHistorico + semHistorico = total", () => {
    const r = resumirCoberturaHistorico();
    expect(r.comHistorico + r.semHistorico).toBe(r.total);
    expect(r.total).toBe(COBERTURA_INDICADORES.length);
  });

  it("calcula o percentual de cobertura corretamente", () => {
    const lista = [
      { indicador: "a", rotulo: "A", temHistoricoPersistido: true, tabela: "t", frequencia: "d", motivoAusencia: null },
      { indicador: "b", rotulo: "B", temHistoricoPersistido: false, tabela: null, frequencia: null, motivoAusencia: "sem fonte" },
    ];
    const r = resumirCoberturaHistorico(lista);
    expect(r.percentualCobertura).toBe(50);
  });

  it("lista vazia não quebra (0%, não NaN)", () => {
    const r = resumirCoberturaHistorico([]);
    expect(r.percentualCobertura).toBe(0);
  });
});
