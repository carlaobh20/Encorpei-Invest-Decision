import { describe, expect, it } from "vitest";
import { calcularScore } from "./score";

/**
 * Testes das réguas do Decision Engine (versao_algoritmo = 1).
 * Se uma faixa mudar aqui sem nova versão no banco, o teste DEVE quebrar —
 * é o contrato "nunca mudar score sem registrar".
 */

describe("calcularScore — faixas e pesos v1", () => {
  it("empresa excelente: ROIC alto, margem alta, caixa líquido, preço razoável", () => {
    const r = calcularScore({
      roic: 0.25,
      margem_liquida: 0.22,
      divida_liquida: -1_000_000_000, // caixa líquido
      patrimonio_liquido: 10_000_000_000,
      lucro_ltm: 1_200_000_000,
      market_cap: 10_000_000_000, // earnings yield 12%
      margens_trimestrais: [0.21, 0.22, 0.22, 0.23],
    });
    expect(r.qualidade).toBe(100);
    expect(r.valuation).toBe(100); // ey >= 12% = teto
    expect(r.risco).toBe(100); // caixa líquido + margens estáveis
    expect(r.score_final).toBe(100);
    expect(r.confianca).toBe("alta"); // 3 componentes presentes
  });

  it("sem valor de mercado: valuation ausente, pesos renormalizados, confiança cai", () => {
    const r = calcularScore({
      roic: 0.25,
      margem_liquida: 0.22,
      divida_liquida: -1,
      patrimonio_liquido: 100,
      lucro_ltm: null,
      market_cap: null,
      margens_trimestrais: [0.21, 0.22, 0.22],
    });
    expect(r.valuation).toBeNull();
    expect(r.confianca).toBe("media"); // 2 de 3 componentes
    expect(r.score_final).toBe(100); // renormalizado entre os presentes
  });

  it("prejuízo (earnings yield negativo) derruba o valuation para 10", () => {
    const r = calcularScore({
      roic: 0.1,
      margem_liquida: 0.05,
      divida_liquida: 50,
      patrimonio_liquido: 100,
      lucro_ltm: -500,
      market_cap: 10_000,
      margens_trimestrais: [],
    });
    expect(r.valuation).toBe(10);
  });

  it("alavancagem alta pontua baixo no balanço", () => {
    const r = calcularScore({
      roic: null,
      margem_liquida: null,
      divida_liquida: 300,
      patrimonio_liquido: 100, // dívida = 3× o patrimônio
      lucro_ltm: null,
      market_cap: null,
      margens_trimestrais: [],
    });
    // qualidade = só o componente de balanço = 10 pts
    expect(r.qualidade).toBe(10);
    expect(r.confianca).toBe("media"); // qualidade + risco presentes
  });

  it("sem dado nenhum: score 0 e confiança baixa — nunca inventa", () => {
    const r = calcularScore({
      roic: null,
      margem_liquida: null,
      divida_liquida: null,
      patrimonio_liquido: null,
      lucro_ltm: null,
      market_cap: null,
      margens_trimestrais: [],
    });
    expect(r.score_final).toBe(0);
    expect(r.confianca).toBe("baixa");
    expect(r.decomposicao).toHaveLength(0);
  });

  it("caso real INTB3 (calibração 01/08/2026): ROIC ~11,9% na escala interna", () => {
    const r = calcularScore({
      roic: 0.119,
      margem_liquida: 0.138,
      divida_liquida: -100,
      patrimonio_liquido: 1000,
      lucro_ltm: 570_000_000,
      market_cap: 4_800_000_000, // ey ~11,9%
      margens_trimestrais: [0.12, 0.13, 0.14, 0.14],
    });
    // ROIC 11,9% cai na faixa 8–12%: 40 + (0.039/0.04)*20 ≈ 59,5
    const compRoic = r.decomposicao.find((d) => d.regra.includes("ROIC"));
    expect(compRoic?.pontos).toBeGreaterThanOrEqual(58);
    expect(compRoic?.pontos).toBeLessThanOrEqual(61);
    // ey 11,875% na faixa 8–12%: perto do teto
    expect(r.valuation).toBeGreaterThanOrEqual(95);
  });
});
