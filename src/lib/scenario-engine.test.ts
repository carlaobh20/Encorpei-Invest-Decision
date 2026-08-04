import { describe, expect, it } from "vitest";
import { avaliarImpactoCenario, avaliarImpactoCarteira, PREMISSA_CENARIO } from "./scenario-engine";

const muitoAlta = { alavancagem: 2.0, retencao: 0.8, modelo: "eletrica_utility" as const };
const alta = { alavancagem: 2.0, retencao: null, modelo: null };
const media = { alavancagem: 0.5, retencao: 0.5, modelo: null };
const baixa = { alavancagem: 0.2, retencao: null, modelo: null };
const muitoBaixa = { alavancagem: 0.2, retencao: 0.1, modelo: "software" as const };
const semDados = { alavancagem: null, retencao: null, modelo: null };

describe("avaliarImpactoCenario", () => {
  it("cenário base: Selic estável → impacto neutro mesmo para sensibilidade muito alta", () => {
    const r = avaliarImpactoCenario("AAAA3", "base", muitoAlta);
    expect(r.selic.direcao).toBe("estavel");
    expect(r.selic.impacto).toBe("neutro");
  });

  it("cenário otimista (Selic cai): sensibilidade muito_alta/alta viram impacto positivo", () => {
    const rMuitoAlta = avaliarImpactoCenario("AAAA3", "otimista", muitoAlta);
    const rAlta = avaliarImpactoCenario("BBBB3", "otimista", alta);
    expect(rMuitoAlta.selic.impacto).toBe("positivo");
    expect(rAlta.selic.impacto).toBe("positivo");
  });

  it("cenário otimista: sensibilidade media/baixa/muito_baixa ficam neutras — nunca inventa direção", () => {
    const rMedia = avaliarImpactoCenario("CCCC3", "otimista", media);
    const rBaixa = avaliarImpactoCenario("DDDD3", "otimista", baixa);
    const rMuitoBaixa = avaliarImpactoCenario("EEEE3", "otimista", muitoBaixa);
    expect(rMedia.selic.impacto).toBe("neutro");
    expect(rBaixa.selic.impacto).toBe("neutro");
    expect(rMuitoBaixa.selic.impacto).toBe("neutro");
  });

  it("cenário pessimista e estressado (Selic sobe): sensibilidade alta/muito_alta viram impacto negativo", () => {
    const rPessimista = avaliarImpactoCenario("AAAA3", "pessimista", alta);
    const rEstressado = avaliarImpactoCenario("AAAA3", "estressado", muitoAlta);
    expect(rPessimista.selic.impacto).toBe("negativo");
    expect(rEstressado.selic.impacto).toBe("negativo");
  });

  it("sem alavancagem nem retenção calculáveis: sensibilidade e impacto ficam null, com aviso", () => {
    const r = avaliarImpactoCenario("FFFF3", "otimista", semDados);
    expect(r.selic.sensibilidade).toBeNull();
    expect(r.selic.impacto).toBeNull();
    expect(r.avisos.some((a) => a.includes("FFFF3"))).toBe(true);
  });

  it("IPCA/PIB/Dólar/Commodities sempre null com motivo, em qualquer cenário — nenhum motor calibrado ainda", () => {
    for (const cenario of ["base", "otimista", "pessimista", "estressado"] as const) {
      const r = avaliarImpactoCenario("AAAA3", cenario, media);
      expect(r.ipca.impacto).toBeNull();
      expect(r.pib.impacto).toBeNull();
      expect(r.dolar.impacto).toBeNull();
      expect(r.commodities.impacto).toBeNull();
      expect(r.ipca.motivo.length).toBeGreaterThan(10);
    }
  });

  it("premissas retornadas batem com a narrativa qualitativa do cenário", () => {
    const r = avaliarImpactoCenario("AAAA3", "pessimista", media);
    expect(r.premissas).toEqual(PREMISSA_CENARIO.pessimista);
  });
});

describe("avaliarImpactoCarteira", () => {
  it("agrega contagem de impacto do canal de Selic por empresa", () => {
    const empresas = [
      { ticker: "AAAA3", ...muitoAlta },
      { ticker: "BBBB3", ...alta },
      { ticker: "CCCC3", ...media },
      { ticker: "DDDD3", ...semDados },
    ];
    const r = avaliarImpactoCarteira("otimista", empresas);
    expect(r.contagem.positivo).toBe(2);
    expect(r.contagem.neutro).toBe(1);
    expect(r.contagem.naoAvaliado).toBe(1);
    expect(r.porEmpresa).toHaveLength(4);
  });

  it("nunca usa linguagem de recomendação", () => {
    const empresas = [{ ticker: "AAAA3", ...muitoAlta }];
    const r = avaliarImpactoCarteira("estressado", empresas);
    const textoPremissas = Object.values(r.porEmpresa[0].premissas).join(" ");
    const texto = [textoPremissas, r.porEmpresa[0].selic.explicacao, r.porEmpresa[0].ipca.motivo].join(" ").toLowerCase();
    expect(texto).not.toMatch(/\bcompre\b|\bvenda\b|recomend/);
  });
});
