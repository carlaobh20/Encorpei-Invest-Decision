import { describe, expect, it } from "vitest";
import { gerarNarrativaIA } from "./decision-center-narrativa";

const SEM_ALERTAS = { critico: 0, importante: 0, informativo: 0 };

describe("gerarNarrativaIA", () => {
  it("sem decisões prioritárias: diz explicitamente que nenhuma ação é necessária (nunca inventa tarefa)", () => {
    const texto = gerarNarrativaIA({
      decisoesPrioritarias: [],
      thesisMonitor: [],
      contagemAlertas: SEM_ALERTAS,
      melhorOportunidade: null,
    });
    expect(texto).toMatch(/nenhuma ação é necessária/i);
  });

  it("nunca usa 'comprar'/'vender'", () => {
    const texto = gerarNarrativaIA({
      decisoesPrioritarias: [
        {
          ticker: "WEGE3",
          empresa: "WEG",
          titulo: "Tese quebrada",
          urgencia: "critica",
          probabilidade: null,
          probabilidadeMotivo: null,
          impactoEsperado: "—",
          tempoEstimadoMinutos: 15,
          motivo: "Tese quebrada — decidir o que fazer.",
          acao: "Reavaliar",
        },
      ],
      thesisMonitor: [],
      contagemAlertas: SEM_ALERTAS,
      melhorOportunidade: null,
    });
    expect(texto.toLowerCase()).not.toMatch(/compr|vend/);
  });

  it("é uma frase corrida (prosa), nunca uma lista de indicadores soltos", () => {
    const texto = gerarNarrativaIA({
      decisoesPrioritarias: [],
      thesisMonitor: [{ ticker: "TIMS3", empresa: "TIM", notaAnterior: 60, notaAtual: 70, diff: 10, tendencia: "subindo", explicacao: "x" }],
      contagemAlertas: SEM_ALERTAS,
      melhorOportunidade: { ticker: "PRIO3", carry: 0.12 },
    });
    expect(texto).not.toMatch(/^[-•]/m);
    expect(texto.length).toBeGreaterThan(0);
  });
});
