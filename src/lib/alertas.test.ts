import { describe, expect, it } from "vitest";
import { classificarSeveridadeAlerta, ordenarPorSeveridade, contarPorSeveridade } from "./alertas";

describe("classificarSeveridadeAlerta", () => {
  it("FDIE crítico sempre vence, mesmo com tese confirmada", () => {
    const r = classificarSeveridadeAlerta({ tipo: "revisao", fdieCritico: true, thesisStatus: "confirmada" });
    expect(r.severidade).toBe("critico");
  });

  it("tese quebrada é crítico mesmo sem FDIE", () => {
    expect(classificarSeveridadeAlerta({ tipo: "mudanca_status", thesisStatus: "quebrada" }).severidade).toBe("critico");
  });

  it("tese inválida (invalidação manual) é crítico", () => {
    expect(classificarSeveridadeAlerta({ tipo: "revisao", thesisStatus: "invalida" }).severidade).toBe("critico");
  });

  it("gatilho negativo disparado é importante", () => {
    const r = classificarSeveridadeAlerta({ tipo: "gatilho_disparado", gatilhoDirecao: "negativo" });
    expect(r.severidade).toBe("importante");
  });

  it("gatilho positivo disparado nunca vira importante nem crítico por si só", () => {
    const r = classificarSeveridadeAlerta({ tipo: "gatilho_disparado", gatilhoDirecao: "positivo" });
    expect(r.severidade).toBe("informativo");
  });

  it("tese enfraquecendo é importante", () => {
    expect(classificarSeveridadeAlerta({ tipo: "revisao", thesisStatus: "enfraquecendo" }).severidade).toBe("importante");
  });

  it("mudança de status genérica (sem outro sinal) é importante", () => {
    expect(classificarSeveridadeAlerta({ tipo: "mudanca_status" }).severidade).toBe("importante");
  });

  it("criação de tese sem outro sinal é informativo", () => {
    expect(classificarSeveridadeAlerta({ tipo: "criacao" }).severidade).toBe("informativo");
  });

  it("nunca escala por suposição — sem sinais fortes, cai pro nível mais baixo sustentável", () => {
    expect(classificarSeveridadeAlerta({ tipo: "revisao", thesisStatus: "fortalecendo" }).severidade).toBe("informativo");
  });
});

describe("ordenarPorSeveridade", () => {
  it("crítico sempre primeiro, informativo sempre por último", () => {
    const alertas = [{ id: 1, severidade: "informativo" as const }, { id: 2, severidade: "critico" as const }, { id: 3, severidade: "importante" as const }];
    const r = ordenarPorSeveridade(alertas);
    expect(r.map((a) => a.id)).toEqual([2, 3, 1]);
  });

  it("não muta o array original", () => {
    const alertas = [{ severidade: "informativo" as const }, { severidade: "critico" as const }];
    const copia = [...alertas];
    ordenarPorSeveridade(alertas);
    expect(alertas).toEqual(copia);
  });
});

describe("contarPorSeveridade", () => {
  it("conta cada severidade corretamente, incluindo zero", () => {
    const r = contarPorSeveridade([{ severidade: "critico" }, { severidade: "critico" }, { severidade: "informativo" }]);
    expect(r).toEqual({ critico: 2, importante: 0, informativo: 1 });
  });

  it("lista vazia: todas as contagens zero", () => {
    expect(contarPorSeveridade([])).toEqual({ critico: 0, importante: 0, informativo: 0 });
  });
});
