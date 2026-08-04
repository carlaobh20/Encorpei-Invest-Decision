import { describe, expect, it } from "vitest";
import { identificarAmeacasCarteira, type EntradaPortfolioRisk } from "./portfolio-risk";

const BASE: EntradaPortfolioRisk = {
  concentracaoRotulo: "baixa",
  maiorPosicao: { ticker: "AAAA3", peso: 0.2 },
  carryMedioPonderado: 0.08,
  qualitiesPonderadas: [{ ticker: "AAAA3", peso: 0.2, quality: 70 }],
  liquidezRotulo: "alta",
  posicoesComFdieCritico: [],
  totalPosicoes: 1,
};

describe("identificarAmeacasCarteira", () => {
  it("carteira saudável em tudo não gera nenhuma ameaça — lista vazia, nunca inventada", () => {
    expect(identificarAmeacasCarteira(BASE)).toEqual([]);
  });

  it("concentração muito alta vira ameaça de severidade alta", () => {
    const r = identificarAmeacasCarteira({ ...BASE, concentracaoRotulo: "muito_alta" });
    expect(r.find((a) => a.chave === "concentracao")?.severidade).toBe("alta");
  });

  it("concentração alta (não muito_alta) vira ameaça de severidade média", () => {
    const r = identificarAmeacasCarteira({ ...BASE, concentracaoRotulo: "alta" });
    expect(r.find((a) => a.chave === "concentracao")?.severidade).toBe("media");
  });

  it("maior posição pesada (>=30%) sem concentração alta ainda vira ameaça própria", () => {
    const r = identificarAmeacasCarteira({ ...BASE, maiorPosicao: { ticker: "GRANDE3", peso: 0.35 } });
    expect(r.find((a) => a.chave === "maior_posicao")).toBeDefined();
  });

  it("carry médio abaixo de IPCA+3% vira ameaça", () => {
    const r = identificarAmeacasCarteira({ ...BASE, carryMedioPonderado: 0.01 });
    expect(r.find((a) => a.chave === "carry_baixo")).toBeDefined();
  });

  it("quality baixa (<40) em posições relevantes vira ameaça, listando os tickers", () => {
    const r = identificarAmeacasCarteira({ ...BASE, qualitiesPonderadas: [{ ticker: "FRACA3", peso: 0.25, quality: 30 }] });
    const a = r.find((x) => x.chave === "quality_baixa");
    expect(a?.texto).toContain("FRACA3");
    expect(a?.severidade).toBe("alta"); // peso 25% >= 20%
  });

  it("liquidez baixa vira ameaça", () => {
    const r = identificarAmeacasCarteira({ ...BASE, liquidezRotulo: "baixa" });
    expect(r.find((a) => a.chave === "liquidez_baixa")).toBeDefined();
  });

  it("FDIE crítico em qualquer posição vira ameaça de severidade alta, listando os tickers", () => {
    const r = identificarAmeacasCarteira({ ...BASE, posicoesComFdieCritico: ["XPTO3"] });
    const a = r.find((x) => x.chave === "fdie_critico");
    expect(a?.severidade).toBe("alta");
    expect(a?.texto).toContain("XPTO3");
  });

  it("ameaças de severidade alta vêm antes das de severidade média na lista final", () => {
    const r = identificarAmeacasCarteira({ ...BASE, concentracaoRotulo: "alta", posicoesComFdieCritico: ["X3"] });
    const severidades = r.map((a) => a.severidade);
    const primeiraMedia = severidades.indexOf("media");
    const ultimaAlta = severidades.lastIndexOf("alta");
    if (primeiraMedia !== -1 && ultimaAlta !== -1) expect(ultimaAlta).toBeLessThan(primeiraMedia);
  });
});
