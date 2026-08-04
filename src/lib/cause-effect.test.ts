import { describe, expect, it } from "vitest";
import { montarArvoreCausal, contarNos, profundidadeAlcancada, RELACOES_CAUSAIS_PADRAO } from "./cause-effect";
import type { Evidencia } from "./evidence";

function evidencia(over: Partial<Evidencia>): Evidencia {
  return {
    ticker: "INTB3",
    categoria: "margem",
    origem: "CVM",
    data: "2026-06-30",
    pesoInformativo: -0.3,
    confiabilidade: "media",
    descricao: "x",
    timestamp: "t",
    hash: "h",
    status: "ativa",
    ...over,
  };
}

describe("montarArvoreCausal", () => {
  it("sem nenhuma evidência: raiz sozinha, sem filhos — nunca inventa o próximo elo", () => {
    const arvore = montarArvoreCausal("Carry caiu de 8% para 5%", "carry", []);
    expect(arvore.filhos).toHaveLength(0);
    expect(profundidadeAlcancada(arvore)).toBe(0);
  });

  it("reproduz a cadeia do exemplo da especificação quando há evidência em cada nível", () => {
    const evidencias: Evidencia[] = [
      evidencia({ categoria: "margem", descricao: "Margem caiu de 20% para 14%" }),
      evidencia({ categoria: "custos", descricao: "Custos operacionais subiram 18%" }),
    ];
    const arvore = montarArvoreCausal("Carry caiu de 8% para 5%", "carry", evidencias);
    expect(arvore.filhos.map((f) => f.descricao)).toContain("Margem caiu de 20% para 14%");
    const margem = arvore.filhos.find((f) => f.categoria === "margem")!;
    expect(margem.filhos.map((f) => f.descricao)).toContain("Custos operacionais subiram 18%");
  });

  it("cadeia incompleta (falta o último elo): árvore para exatamente onde a evidência acaba", () => {
    const evidencias: Evidencia[] = [evidencia({ categoria: "margem", descricao: "Margem caiu" })];
    const arvore = montarArvoreCausal("Carry caiu", "carry", evidencias);
    const margem = arvore.filhos.find((f) => f.categoria === "margem")!;
    expect(margem.filhos).toHaveLength(0); // sem evidência de custos → para aqui, honestamente
  });

  it("nunca entra em loop — categoria já usada no caminho não reaparece", () => {
    // ciclo só entre categorias de evidência de verdade (roic ↔ margem) — a
    // raiz "carry" não é uma EvidenciaCategoria, então nunca aparece como
    // categoria de uma Evidencia (ver CategoriaCausal em cause-effect.ts).
    const mapaCiclico = { roic: ["margem"], margem: ["roic"] } as const;
    const evidencias: Evidencia[] = [
      evidencia({ categoria: "margem", descricao: "Margem caiu" }),
      evidencia({ categoria: "roic", descricao: "ROIC caiu de novo (não devia aparecer)" }),
    ];
    const arvore = montarArvoreCausal("ROIC caiu", "roic", evidencias, { mapa: mapaCiclico as any });
    const margem = arvore.filhos.find((f) => f.categoria === "margem")!;
    expect(margem.filhos).toHaveLength(0); // "roic" já estava no caminho — não volta
  });

  it("respeita profundidadeMaxima mesmo com evidência disponível", () => {
    const evidencias: Evidencia[] = [
      evidencia({ categoria: "margem", descricao: "nivel 1" }),
      evidencia({ categoria: "custos", descricao: "nivel 2" }),
    ];
    const arvore = montarArvoreCausal("raiz", "carry", evidencias, { profundidadeMaxima: 1 });
    const margem = arvore.filhos.find((f) => f.categoria === "margem")!;
    expect(margem.filhos).toHaveLength(0); // nível 2 cortado pela profundidade máxima
  });

  it("evidências inativas (supersedida/refutada) nunca entram na árvore", () => {
    const evidencias: Evidencia[] = [evidencia({ categoria: "margem", status: "refutada" })];
    const arvore = montarArvoreCausal("Carry caiu", "carry", evidencias);
    expect(arvore.filhos).toHaveLength(0);
  });

  it("raiz sem categoria (null): nunca busca evidência nenhuma, árvore fica só com o evento", () => {
    const evidencias: Evidencia[] = [evidencia({ categoria: "margem", descricao: "Margem caiu" })];
    const arvore = montarArvoreCausal("Evento sem categoria conhecida", null, evidencias);
    expect(arvore.categoria).toBeNull();
    expect(arvore.filhos).toHaveLength(0);
  });

  it("carrega confiabilidade e categoria em cada nó — quem consome sabe o quão firme é o elo", () => {
    const evidencias: Evidencia[] = [evidencia({ categoria: "margem", confiabilidade: "baixa" })];
    const arvore = montarArvoreCausal("Carry caiu", "carry", evidencias);
    expect(arvore.filhos[0].confiabilidade).toBe("baixa");
    expect(arvore.filhos[0].categoria).toBe("margem");
    expect(arvore.confiabilidade).toBeNull(); // a raiz é o evento, não uma evidência
  });
});

describe("contarNos / profundidadeAlcancada", () => {
  it("conta a raiz mesmo sem filhos", () => {
    const arvore = montarArvoreCausal("x", "carry", []);
    expect(contarNos(arvore)).toBe(1);
  });

  it("conta toda a árvore, nível a nível", () => {
    const evidencias: Evidencia[] = [
      evidencia({ categoria: "margem", descricao: "a" }),
      evidencia({ categoria: "custos", descricao: "b" }),
    ];
    const arvore = montarArvoreCausal("raiz", "carry", evidencias);
    expect(contarNos(arvore)).toBe(3); // raiz + margem + custos
    expect(profundidadeAlcancada(arvore)).toBe(2);
  });
});

describe("RELACOES_CAUSAIS_PADRAO", () => {
  it("está definido para os nós centrais do exemplo da especificação (carry, margem)", () => {
    expect(RELACOES_CAUSAIS_PADRAO.carry).toBeDefined();
    expect(RELACOES_CAUSAIS_PADRAO.margem).toContain("custos");
  });
});
