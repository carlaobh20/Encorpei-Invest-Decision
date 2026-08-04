import { describe, expect, it } from "vitest";
import { projetarIndicador, JANELA_TRAILING_PADRAO, FORECAST_ENGINE_VERSAO } from "./forecast-engine";
import type { PontoSerieIndicador } from "./forecast-engine";

function serie(valores: number[]): PontoSerieIndicador[] {
  return valores.map((valor, i) => ({ periodo: `T${i + 1}`, valor }));
}

describe("projetarIndicador", () => {
  it("série curta demais: estimativa indisponível com motivo, versão sempre presente", () => {
    const r = projetarIndicador("receita", serie([100, 110]));
    expect(r.estimativaVariacao.valor).toBeNull();
    expect(r.estimativaVariacao.motivo).not.toBeNull();
    expect(r.valorProjetado).toBeNull();
    expect(r.confiabilidade).toBeNull();
    expect(r.versao).toBe(FORECAST_ENGINE_VERSAO);
  });

  it("crescimento constante: projeta corretamente 1 período à frente", () => {
    // crescimento de 10% a cada período, 5 pontos (>= janela padrão de 4 + 1)
    const r = projetarIndicador("receita", serie([100, 110, 121, 133.1, 146.41]));
    expect(r.estimativaVariacao.valor).not.toBeNull();
    expect(r.estimativaVariacao.valor!).toBeCloseTo(0.1, 6);
    expect(r.valorProjetado).not.toBeNull();
    expect(r.valorProjetado!).toBeCloseTo(146.41 * 1.1, 4);
    expect(r.confiabilidade).toBe("alta");
  });

  it("descarta variações com valor anterior zero, com aviso — nunca divide por zero", () => {
    const r = projetarIndicador("lucro", serie([0, 50, 55, 60.5, 66.55]));
    expect(r.avisos.some((a) => a.includes("zero"))).toBe(true);
    expect(r.estimativaVariacao.valor).not.toBeNull(); // ainda sobrou variação válida
  });

  it("descarta variações com valor anterior negativo, com aviso — % de variação não é interpretável", () => {
    const r = projetarIndicador("lucro", serie([-10, 50, 55, 60.5, 66.55]));
    expect(r.avisos.some((a) => a.includes("negativo"))).toBe(true);
    expect(r.estimativaVariacao.valor).not.toBeNull(); // ainda sobrou variação válida
  });

  it("todas as variações inválidas (zero/negativo): indisponível, nunca inventa taxa", () => {
    const r = projetarIndicador("lucro", serie([0, 0, 0, 0, 0]));
    expect(r.estimativaVariacao.valor).toBeNull();
    expect(r.estimativaVariacao.motivo).toContain("zero ou negativos");
    expect(r.valorProjetado).toBeNull();
  });

  it("janela customizada é respeitada", () => {
    const r = projetarIndicador("receita", serie([100, 110, 121]), { janelaTrailing: 2 });
    expect(r.estimativaVariacao.valor).not.toBeNull();
    expect(r.confiabilidade).not.toBeNull();
  });

  it("fonte é sempre extrapolacao_trailing — nunca produz consenso_mercado", () => {
    const r = projetarIndicador("receita", serie([100, 110, 121, 133.1, 146.41]));
    expect(r.fonte).toBe("extrapolacao_trailing");
  });

  it("amostra pequena (3 variações) recebe confiabilidade baixa/media, nunca alta", () => {
    const r = projetarIndicador("receita", serie([100, 110, 121, 133.1]), { janelaTrailing: 3 });
    expect(r.confiabilidade).not.toBe("alta");
  });

  it("premissas sempre mencionam o método e a janela usada", () => {
    const r = projetarIndicador("receita", serie([100, 110, 121, 133.1, 146.41]), { janelaTrailing: JANELA_TRAILING_PADRAO });
    expect(r.premissas.some((p) => p.includes("extrapolação trailing"))).toBe(true);
    expect(r.premissas.some((p) => p.includes(String(JANELA_TRAILING_PADRAO)))).toBe(true);
  });

  it("nunca usa linguagem de recomendação", () => {
    const r = projetarIndicador("receita", serie([100, 110, 121, 133.1, 146.41]));
    const texto = [...r.premissas, ...r.avisos].join(" ").toLowerCase();
    expect(texto).not.toMatch(/\bcompre\b|\bvenda\b|recomend/);
  });
});
