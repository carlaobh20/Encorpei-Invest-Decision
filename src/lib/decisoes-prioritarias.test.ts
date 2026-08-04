import { describe, expect, it } from "vitest";
import { classificarUrgencia, montarDecisoesPrioritarias, type EntradaDecisaoPrioritaria } from "./decisoes-prioritarias";
import type { Decision } from "./decision-object";
import type { PerfilTese } from "./thesis-engine";

function decision(campos: Partial<Decision>): Decision {
  return {
    fdie: { ok: 0, alerta: 0, critico: 0, total: 0 },
    carry: null,
    probability: null,
    expectedReturn: { valor: null, intervaloInferior: null, intervaloSuperior: null, nivelConfianca: null, motivo: "sem dado" },
    ...campos,
  } as unknown as Decision;
}

function perfil(thesisStatus: PerfilTese["thesisStatus"]): PerfilTese {
  return { thesisStatus } as unknown as PerfilTese;
}

function entrada(campos: Partial<EntradaDecisaoPrioritaria>): EntradaDecisaoPrioritaria {
  return {
    ticker: "WEGE3",
    empresa: "WEG",
    decision: decision({}),
    perfilTese: null,
    severidadesRecentes: [],
    ...campos,
  };
}

describe("classificarUrgencia", () => {
  it("FDIE crítico vence qualquer outro sinal — sempre 'critica'", () => {
    const r = classificarUrgencia(
      entrada({
        decision: decision({ fdie: { ok: 0, alerta: 0, critico: 1, total: 1 } }),
        perfilTese: perfil("fortalecendo"),
      })
    );
    expect(r.urgencia).toBe("critica");
  });

  it("tese quebrada é crítica mesmo sem FDIE", () => {
    const r = classificarUrgencia(entrada({ perfilTese: perfil("quebrada") }));
    expect(r.urgencia).toBe("critica");
  });

  it("tese enfraquecendo é 'alta', não 'critica'", () => {
    const r = classificarUrgencia(entrada({ perfilTese: perfil("enfraquecendo") }));
    expect(r.urgencia).toBe("alta");
  });

  it("sem nenhum sinal de risco: 'baixa'", () => {
    const r = classificarUrgencia(entrada({ perfilTese: perfil("confirmada") }));
    expect(r.urgencia).toBe("baixa");
  });

  it("nunca aumenta severidade por suposição: alerta informativo isolado não move a urgência", () => {
    const r = classificarUrgencia(entrada({ severidadesRecentes: ["informativo"], perfilTese: perfil("confirmada") }));
    expect(r.urgencia).toBe("baixa");
  });
});

describe("montarDecisoesPrioritarias", () => {
  it("nunca inclui urgência 'baixa' — Seção 1 é só o que precisa de decisão", () => {
    const r = montarDecisoesPrioritarias([entrada({ perfilTese: perfil("confirmada") })]);
    expect(r).toHaveLength(0);
  });

  it("ordena por urgência (crítica primeiro), nunca por score", () => {
    const r = montarDecisoesPrioritarias([
      entrada({ ticker: "A", perfilTese: perfil("enfraquecendo") }),
      entrada({ ticker: "B", perfilTese: perfil("quebrada") }),
    ]);
    expect(r.map((d) => d.ticker)).toEqual(["B", "A"]);
  });

  it("limita a `max` itens", () => {
    const entradas = Array.from({ length: 8 }, (_, i) => entrada({ ticker: `T${i}`, perfilTese: perfil("quebrada") }));
    const r = montarDecisoesPrioritarias(entradas, 5);
    expect(r).toHaveLength(5);
  });

  it("probabilidade null vem com motivo explícito, nunca escondido", () => {
    const r = montarDecisoesPrioritarias([entrada({ perfilTese: perfil("quebrada") })]);
    expect(r[0].probabilidade).toBeNull();
    expect(r[0].probabilidadeMotivo).toMatch(/Diário/);
  });

  it("ação nunca usa 'comprar'/'vender' — só o vocabulário permitido", () => {
    const r = montarDecisoesPrioritarias([entrada({ perfilTese: perfil("quebrada") })]);
    expect(["Estudar", "Revisar", "Acompanhar", "Monitorar", "Reavaliar", "Aprofundar"]).toContain(r[0].acao);
  });
});
