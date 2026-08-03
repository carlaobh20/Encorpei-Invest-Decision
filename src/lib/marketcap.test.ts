import { describe, expect, it } from "vitest";
import { marketCapSelecionado } from "./marketcap";

/**
 * Auditoria de dados de 03/08/2026 — caso SBSP3: acoes_totais desatualizado
 * (CVM ainda não refilou após um desdobramento aparente) fazia o sistema
 * publicar um valor de mercado ~80% menor que a realidade, sem nenhum
 * alerta. Estes testes travam a correção: divergência grande (>=10%) faz o
 * sistema preferir o dado ao vivo da própria fonte, não o número calculado
 * a partir de uma contagem de ações que pode estar velha.
 */

describe("marketCapSelecionado", () => {
  it("sem divergência: usa qtd_acoes × fechamento (dado oficial)", () => {
    const r = marketCapSelecionado({
      qtdAcoes: 1_000_000,
      fechamento: 10,
      marketCapMercado: 10_050_000, // 0,5% de diferença — dentro da banda
      ehUnit: false,
    });
    expect(r.fonte).toBe("cvm_acoes_totais");
    expect(r.valor).toBe(10_000_000);
    expect(r.divergenciaPct).toBeCloseTo(0.005, 3);
  });

  it("caso SBSP3: acoes_totais desatualizado (~80% menor) → prefere o valor ao vivo da fonte", () => {
    // acoes_totais defasado (704.906.807, pré-desdobramento) × fechamento pós-desdobramento
    const qtdDesatualizada = 704_906_807;
    const fechamentoPosDesdobramento = 31.11;
    const marketCapReal = 109_600_000_000; // ~R$109,6 bi, valor real reportado pela fonte

    const r = marketCapSelecionado({
      qtdAcoes: qtdDesatualizada,
      fechamento: fechamentoPosDesdobramento,
      marketCapMercado: marketCapReal,
      ehUnit: false,
    });

    expect(r.fonte).toBe("brapi_live_divergencia");
    expect(r.valor).toBe(marketCapReal);
    expect(r.divergenciaPct).toBeGreaterThan(0.1);
  });

  it("divergência moderada (5-10%) ainda confia no dado oficial (não é 'bloqueio')", () => {
    const r = marketCapSelecionado({
      qtdAcoes: 1_000_000,
      fechamento: 10,
      marketCapMercado: 10_900_000, // ~8,3% — abaixo do limiar de 10%
      ehUnit: false,
    });
    expect(r.fonte).toBe("cvm_acoes_totais");
    expect(r.valor).toBe(10_000_000);
  });

  it("sem qtd_acoes ou sem fechamento: cai para o valor ao vivo, se houver", () => {
    const r = marketCapSelecionado({
      qtdAcoes: null,
      fechamento: 10,
      marketCapMercado: 5_000_000,
      ehUnit: false,
    });
    expect(r.fonte).toBe("brapi_live");
    expect(r.valor).toBe(5_000_000);
  });

  it("unit (ex.: TAEE11): nunca usa qtd_acoes × fechamento, mesmo com os dois presentes", () => {
    const r = marketCapSelecionado({
      qtdAcoes: 1_000_000,
      fechamento: 10,
      marketCapMercado: 5_000_000,
      ehUnit: true,
    });
    expect(r.fonte).toBe("brapi_live");
    expect(r.valor).toBe(5_000_000);
  });

  it("nenhum dado disponível: retorna null com fonte 'indisponivel'", () => {
    const r = marketCapSelecionado({
      qtdAcoes: null,
      fechamento: null,
      marketCapMercado: null,
      ehUnit: false,
    });
    expect(r.valor).toBeNull();
    expect(r.fonte).toBe("indisponivel");
  });

  it("sem valor ao vivo para comparar: usa o oficial sem alegar divergência", () => {
    const r = marketCapSelecionado({
      qtdAcoes: 1_000_000,
      fechamento: 10,
      marketCapMercado: null,
      ehUnit: false,
    });
    expect(r.fonte).toBe("cvm_acoes_totais");
    expect(r.valor).toBe(10_000_000);
    expect(r.divergenciaPct).toBeNull();
  });
});
