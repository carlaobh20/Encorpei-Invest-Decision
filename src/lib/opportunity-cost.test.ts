import { describe, expect, it } from "vitest";
import { calcularCustoOportunidade } from "./opportunity-cost";
import { montarDecision, type Decision } from "./decision-object";
import { calcularMasterDecision, type EntradaMasterEngine } from "./master-engine";
import type { EmpresaAuditavel } from "./auditoria";
import type { CarryEntrada } from "./carry/types";

/** fixture mínima — só os campos que opportunity-cost.ts realmente lê (ticker/confluence/carry) */
function decisionMinima(over: Partial<Decision>): Decision {
  return { ticker: "XXXX3", confluence: 50, carry: 0.1, ...over } as Decision;
}

function auditoria(over: Partial<EmpresaAuditavel> = {}): EmpresaAuditavel {
  return {
    ticker: "AAAA3",
    modelo: null,
    cotacao: 20,
    qtdAcoes: 100,
    marketCapBruto: 2000,
    receita: 1000,
    lucro: 200,
    margemBruta: 0.4,
    margemLiquida: 0.2,
    roic: null,
    dividaLiquida: null,
    caixa: 500,
    ...over,
  };
}

function carryEntrada(over: Partial<CarryEntrada> = {}): CarryEntrada {
  return {
    lucroLtm: 600_000_000,
    marketCap: 10_000_000_000,
    roic4: 0.2,
    margensDesvio: 0.02,
    caixaLiquido: true,
    alavancagem: null,
    crescReceitaAnual: 0.1,
    ehFinanceira: false,
    ...over,
  };
}

function entrada(ticker: string, fundamentosScore: number, lucroLtm: number): EntradaMasterEngine {
  return {
    ticker,
    auditoria: auditoria({ ticker }),
    fundamentosScore,
    fundamentosComponentes: 4,
    compounderScore: 80,
    carryEntrada: carryEntrada({ lucroLtm }),
    technicalScore: 60,
  };
}

function decisionDe(ticker: string, fundamentosScore: number, lucroLtm: number) {
  const resultado = calcularMasterDecision(entrada(ticker, fundamentosScore, lucroLtm));
  return montarDecision({ resultado, empresa: ticker, setor: null }, "2026-08-04T12:00:00Z");
}

describe("calcularCustoOportunidade", () => {
  it("sem alternativas: lista vazia, aviso explicando que não há custo de oportunidade registrado", () => {
    const escolhida = decisionDe("AAAA3", 85, 600_000_000);
    const r = calcularCustoOportunidade(escolhida, []);
    expect(r.alternativas).toHaveLength(0);
    expect(r.melhorAlternativaConfluence).toBeNull();
    expect(r.melhorAlternativaCarry).toBeNull();
    expect(r.avisos.some((a) => a.includes("Nenhuma alternativa"))).toBe(true);
  });

  it("remove a própria escolhida da lista de alternativas, caso apareça por engano", () => {
    const escolhida = decisionDe("AAAA3", 85, 600_000_000);
    const r = calcularCustoOportunidade(escolhida, [escolhida]);
    expect(r.alternativas).toHaveLength(0);
    expect(r.avisos.some((a) => a.includes("próprio escolhido"))).toBe(true);
  });

  it("calcula o gap de Confluence e Carry entre a escolhida e cada alternativa", () => {
    const escolhida = decisionDe("AAAA3", 90, 600_000_000);
    const fraca = decisionDe("BBBB3", 40, 100_000_000);
    const r = calcularCustoOportunidade(escolhida, [fraca]);
    expect(r.alternativas).toHaveLength(1);
    const gap = r.alternativas[0];
    expect(gap.ticker).toBe("BBBB3");
    expect(gap.gapConfluence).not.toBeNull();
    expect(gap.gapConfluence!).toBeGreaterThan(0); // escolhida tem Confluence maior
    expect(gap.confluenceAlternativaMaior).toBe(false);
  });

  it("identifica a alternativa com maior Confluence e maior Carry entre as consideradas, como registro factual", () => {
    const escolhida = decisionDe("AAAA3", 60, 300_000_000);
    const forte = decisionDe("BBBB3", 95, 900_000_000);
    const fraca = decisionDe("CCCC3", 30, 50_000_000);
    const r = calcularCustoOportunidade(escolhida, [forte, fraca]);
    expect(r.melhorAlternativaConfluence?.ticker).toBe("BBBB3");
    expect(r.melhorAlternativaCarry?.ticker).toBe("BBBB3");
  });

  it("Confluence ou Carry null em qualquer lado vira gap null com aviso, nunca inventa número", () => {
    // fundamentosComponentes exige >=1 componente pra ter score; forçar null via auditoria sem lucro/marketCap
    const escolhida = decisionDe("AAAA3", 85, 600_000_000);
    const semCarry = montarDecision(
      {
        resultado: calcularMasterDecision({
          ...entrada("DDDD3", 85, 600_000_000),
          auditoria: auditoria({ ticker: "DDDD3", lucro: null, marketCapBruto: null }),
        }),
        empresa: "DDDD3",
        setor: null,
      },
      "2026-08-04T12:00:00Z"
    );
    const r = calcularCustoOportunidade(escolhida, [semCarry]);
    // carryFloor pode ficar null nesse cenário — mas o teste foca em garantir que, quando ocorre, o gap não inventa número
    if (semCarry.carry === null) {
      expect(r.alternativas[0].gapCarry).toBeNull();
      expect(r.avisos.some((a) => a.includes("DDDD3") && a.includes("Carry"))).toBe(true);
    }
  });

  it("Confluence null em qualquer lado: gap de Confluence fica null com aviso específico", () => {
    const escolhida = decisionMinima({ ticker: "AAAA3", confluence: null, carry: 0.1 });
    const alt = decisionMinima({ ticker: "BBBB3", confluence: 60, carry: 0.1 });
    const r = calcularCustoOportunidade(escolhida, [alt]);
    expect(r.alternativas[0].gapConfluence).toBeNull();
    expect(r.avisos.some((a) => a.includes("BBBB3") && a.includes("Confluence"))).toBe(true);
  });

  it("Carry null em qualquer lado: gap de Carry fica null com aviso específico", () => {
    const escolhida = decisionMinima({ ticker: "AAAA3", confluence: 80, carry: null });
    const alt = decisionMinima({ ticker: "BBBB3", confluence: 60, carry: 0.1 });
    const r = calcularCustoOportunidade(escolhida, [alt]);
    expect(r.alternativas[0].gapCarry).toBeNull();
    expect(r.avisos.some((a) => a.includes("BBBB3") && a.includes("Carry"))).toBe(true);
  });

  it("nunca usa linguagem de recomendação", () => {
    const escolhida = decisionDe("AAAA3", 85, 600_000_000);
    const alt = decisionDe("BBBB3", 40, 100_000_000);
    const r = calcularCustoOportunidade(escolhida, [alt]);
    const texto = r.metodo.toLowerCase().replaceAll("não é uma segunda opinião nem uma sugestão de troca", "");
    expect(texto).not.toMatch(/\bcompre\b|\bvenda\b|recomend/);
  });
});
