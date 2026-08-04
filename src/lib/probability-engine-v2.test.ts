import { describe, expect, it } from "vitest";
import { calcularProbabilidadeHistoricaV2, HORIZONTES_MESES, MIN_JANELAS_NAO_SOBREPOSTAS } from "./probability-engine-v2";
import type { ObservacaoBenchmark } from "./patrimonio";

function datas(n: number): string[] {
  return Array.from({ length: n }, (_, i) => `D${String(i).padStart(5, "0")}`);
}

/** Empresa cresce ~28,7%/janela de 252 pregões (1.001/dia); CDI e Ibovespa crescem bem mais devagar — empresa deve superar os dois quase sempre. */
function serieCrescenteRapida(n: number): { precos: ObservacaoBenchmark[]; cdi: ObservacaoBenchmark[]; ibovespa: ObservacaoBenchmark[] } {
  const ds = datas(n);
  const precos = ds.map((data, i) => ({ data, valor: 100 * Math.pow(1.001, i) }));
  const cdi = ds.map((data) => ({ data, valor: 0.03 })); // 0,03%/dia
  const ibovespa = ds.map((data, i) => ({ data, valor: 100 * Math.pow(1.0002, i) }));
  return { precos, cdi, ibovespa };
}

describe("calcularProbabilidadeHistoricaV2", () => {
  it("histórico curto (realidade de hoje do sistema): todos os horizontes vêm null com motivo", () => {
    const { precos, cdi, ibovespa } = serieCrescenteRapida(60); // ~3 meses de pregões
    const r = calcularProbabilidadeHistoricaV2({ ticker: "INTB3", precos, cdi, ibovespa });
    for (const h of HORIZONTES_MESES) {
      const res = r.horizontes[h];
      expect(res.probabilidadeSuperarCdi).toBeNull();
      expect(res.probabilidadeSuperarIbovespa).toBeNull();
      expect(res.retornoEsperado.valor).toBeNull();
      expect(res.motivo).not.toBeNull();
      expect(res.motivo).toContain("pregões");
    }
  });

  it("histórico suficiente só para o horizonte de 12 meses: 12m destravado, os demais continuam null", () => {
    // 600 pregões: 12m (252) cabe 2x sem sobreposição; 24m (504) só cabe 1x.
    const { precos, cdi, ibovespa } = serieCrescenteRapida(600);
    const r = calcularProbabilidadeHistoricaV2({ ticker: "INTB3", precos, cdi, ibovespa });

    const doze = r.horizontes[12];
    expect(doze.motivo).toBeNull();
    expect(doze.janelasNaoSobrepostasDisponiveis).toBeGreaterThanOrEqual(MIN_JANELAS_NAO_SOBREPOSTAS);
    expect(doze.observacoesJanelasMoveis).toBeGreaterThan(0);
    expect(doze.probabilidadeSuperarCdi).toBeCloseTo(1, 10);
    expect(doze.probabilidadeSuperarIbovespa).toBeCloseTo(1, 10);
    expect(doze.retornoEsperado.valor).toBeCloseTo(Math.pow(1.001, 252) - 1, 4);
    expect(doze.drawdownEsperado.valor).toBeCloseTo(0, 6); // série sempre crescente, nunca cai

    for (const h of [24, 36, 60] as const) {
      expect(r.horizontes[h].motivo).not.toBeNull();
      expect(r.horizontes[h].probabilidadeSuperarCdi).toBeNull();
    }
  });

  it("nunca promete retorno futuro no texto do método", () => {
    const { precos, cdi, ibovespa } = serieCrescenteRapida(60);
    const r = calcularProbabilidadeHistoricaV2({ ticker: "INTB3", precos, cdi, ibovespa });
    expect(r.metodo.toLowerCase()).not.toMatch(/garantid|prometid|compre|venda|recomend/);
  });

  it("ticker vazio de preços: todos os horizontes null, sem quebrar", () => {
    const r = calcularProbabilidadeHistoricaV2({ ticker: "ZZZZ3", precos: [], cdi: [], ibovespa: [] });
    for (const h of HORIZONTES_MESES) {
      expect(r.horizontes[h].motivo).not.toBeNull();
    }
  });
});
