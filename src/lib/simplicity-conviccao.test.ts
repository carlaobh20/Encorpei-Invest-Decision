import { describe, expect, it } from "vitest";
import { classificarConviccaoExibicao } from "./simplicity-conviccao";

describe("classificarConviccaoExibicao", () => {
  it("indefinida sempre vira neutra — nunca inventa uma leitura mais forte por falta de dado", () => {
    const r = classificarConviccaoExibicao({ conviccao: "indefinida", score: null, componentesDisponiveis: 0, totalComponentes: 4 });
    expect(r).toBe("neutra");
  });

  it("Convicção Máxima só aparece com os 3 critérios simultâneos: alta + score>=95 + todos os componentes disponíveis", () => {
    const r = classificarConviccaoExibicao({ conviccao: "alta", score: 96, componentesDisponiveis: 4, totalComponentes: 4 });
    expect(r).toBe("conviccao_maxima");
  });

  it("alta com score 96 mas faltando um componente NÃO vira Convicção Máxima — vira Muito Forte", () => {
    const r = classificarConviccaoExibicao({ conviccao: "alta", score: 96, componentesDisponiveis: 3, totalComponentes: 4 });
    expect(r).toBe("muito_forte");
  });

  it("alta com todos os componentes mas score 90 (abaixo de 95) NÃO vira Convicção Máxima", () => {
    const r = classificarConviccaoExibicao({ conviccao: "alta", score: 90, componentesDisponiveis: 4, totalComponentes: 4 });
    expect(r).toBe("muito_forte");
  });

  it("alta com score entre 75-84 vira Forte (não Muito Forte)", () => {
    const r = classificarConviccaoExibicao({ conviccao: "alta", score: 80, componentesDisponiveis: 4, totalComponentes: 4 });
    expect(r).toBe("forte");
  });

  it("moderada com score >= 60 vira Boa", () => {
    const r = classificarConviccaoExibicao({ conviccao: "moderada", score: 65, componentesDisponiveis: 2, totalComponentes: 4 });
    expect(r).toBe("boa");
  });

  it("moderada com score < 60 vira Neutra", () => {
    const r = classificarConviccaoExibicao({ conviccao: "moderada", score: 50, componentesDisponiveis: 2, totalComponentes: 4 });
    expect(r).toBe("neutra");
  });

  it("baixa com score < 25 vira Muito Fraca", () => {
    const r = classificarConviccaoExibicao({ conviccao: "baixa", score: 15, componentesDisponiveis: 1, totalComponentes: 4 });
    expect(r).toBe("muito_fraca");
  });

  it("baixa com score >= 25 vira Fraca", () => {
    const r = classificarConviccaoExibicao({ conviccao: "baixa", score: 30, componentesDisponiveis: 1, totalComponentes: 4 });
    expect(r).toBe("fraca");
  });

  it("baixa com score null vira Fraca (não Muito Fraca) — nunca assume o pior sem dado", () => {
    const r = classificarConviccaoExibicao({ conviccao: "baixa", score: null, componentesDisponiveis: 1, totalComponentes: 4 });
    expect(r).toBe("fraca");
  });
});
