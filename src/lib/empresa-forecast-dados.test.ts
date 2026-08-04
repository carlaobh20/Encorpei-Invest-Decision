import { describe, expect, it } from "vitest";
import { montarForecastEmpresa } from "./empresa-forecast-dados";

describe("montarForecastEmpresa", () => {
  it("com série curta demais, retorna indisponível com motivo — nunca inventa projeção", () => {
    const r = montarForecastEmpresa([{ competencia: "2025-12-31", receita_liquida: 100, lucro_liquido: 10, margem_liquida: 0.1, roic: 0.2 }], []);
    expect(r.receita.valorProjetado).toBeNull();
    expect(r.receita.estimativaVariacao.motivo).toBeTruthy();
  });

  it("com série suficiente, projeta 1 período à frente por extrapolação trailing", () => {
    const fundamentos = [
      { competencia: "2023-12-31", receita_liquida: 100, lucro_liquido: 10, margem_liquida: 0.1, roic: 0.15 },
      { competencia: "2024-12-31", receita_liquida: 110, lucro_liquido: 11, margem_liquida: 0.1, roic: 0.15 },
      { competencia: "2025-12-31", receita_liquida: 121, lucro_liquido: 12.1, margem_liquida: 0.1, roic: 0.15 },
    ];
    const r = montarForecastEmpresa(fundamentos, []);
    expect(r.receita.valorProjetado).not.toBeNull();
    expect(r.receita.fonte).toBe("extrapolacao_trailing");
  });

  it("descarta período com valor null antes de montar a série — nunca trata null como zero", () => {
    const fundamentos = [
      { competencia: "2023-12-31", receita_liquida: 100, lucro_liquido: null, margem_liquida: 0.1, roic: 0.15 },
      { competencia: "2024-12-31", receita_liquida: null, lucro_liquido: 11, margem_liquida: 0.1, roic: 0.15 },
    ];
    const r = montarForecastEmpresa(fundamentos, []);
    expect(r.receita.estimativaVariacao.motivo).toBeTruthy();
  });

  it("Carry usa a série de carry_score (diária), independente das séries anuais", () => {
    const carry = Array.from({ length: 12 }, (_, i) => ({ data: `2026-0${(i % 9) + 1}-01`, carryReal: 0.05 + i * 0.001 }));
    const r = montarForecastEmpresa([], carry);
    expect(r.carry.fonte).toBe("extrapolacao_trailing");
  });
});
