import { describe, expect, it } from "vitest";
import { classificarEstadoTecnico } from "./simplicity-estados-tecnicos";

describe("classificarEstadoTecnico", () => {
  it("score null (sem histórico suficiente) sempre vira 'Sem sinal', nunca 'Monitorando'", () => {
    expect(classificarEstadoTecnico(null)).toBe("sem_sinal");
  });

  it("score >= 95 vira Convicção Máxima", () => {
    expect(classificarEstadoTecnico(96)).toBe("conviccao_maxima");
  });

  it("score 80-94 vira Alta Convicção", () => {
    expect(classificarEstadoTecnico(85)).toBe("alta_conviccao");
  });

  it("score 65-79 vira Boa Oportunidade", () => {
    expect(classificarEstadoTecnico(70)).toBe("boa_oportunidade");
  });

  it("score 45-64 vira Sinal Inicial", () => {
    expect(classificarEstadoTecnico(50)).toBe("sinal_inicial");
  });

  it("score abaixo de 45 vira Monitorando, não Sem sinal — score existe, só é baixo", () => {
    expect(classificarEstadoTecnico(20)).toBe("monitorando");
    expect(classificarEstadoTecnico(0)).toBe("monitorando");
  });

  it("limiares são inclusivos nas bordas exatas", () => {
    expect(classificarEstadoTecnico(95)).toBe("conviccao_maxima");
    expect(classificarEstadoTecnico(80)).toBe("alta_conviccao");
    expect(classificarEstadoTecnico(65)).toBe("boa_oportunidade");
    expect(classificarEstadoTecnico(45)).toBe("sinal_inicial");
  });
});
