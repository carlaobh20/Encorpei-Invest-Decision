import { describe, expect, it } from "vitest";
import { gerarCoachInsight, type SinaisCoachInsight } from "./coach-insights";

const BASE: SinaisCoachInsight = {
  carryReal: null,
  carryComparacaoSetor: "indisponivel",
  roicAtual: null,
  roicVariacaoRelativa: null,
  earningsYield: null,
  quality: null,
  growth: null,
  technical: null,
};

describe("gerarCoachInsight", () => {
  it("sem nenhum sinal, devolve null — nunca inventa insight", () => {
    expect(gerarCoachInsight(BASE)).toBeNull();
  });

  it("erro clássico detectado tem prioridade sobre tudo o mais", () => {
    const r = gerarCoachInsight({
      ...BASE,
      quality: 20,
      technical: 90,
      carryReal: 0.15,
      carryComparacaoSetor: "acima",
      roicVariacaoRelativa: -0.5,
    });
    expect(r?.titulo).toBe("Olhar apenas análise técnica");
  });

  it("ROIC caiu (variação <= -10%) sem erro clássico ativo", () => {
    const r = gerarCoachInsight({ ...BASE, roicVariacaoRelativa: -0.15 });
    expect(r?.titulo).toBe("ROIC caiu");
  });

  it("queda de ROIC menor que 10% não dispara o insight", () => {
    expect(gerarCoachInsight({ ...BASE, roicVariacaoRelativa: -0.05 })).toBeNull();
  });

  it("Carry acima da média do setor, sem sinais anteriores, vira 'Carry elevado' com o texto literal da spec", () => {
    const r = gerarCoachInsight({ ...BASE, carryReal: 0.118, carryComparacaoSetor: "acima" });
    expect(r?.titulo).toBe("Carry elevado");
    expect(r?.texto).toContain("Empresas com Carry elevado tendem a oferecer maior proteção do patrimônio contra inflação, mas isso só cria valor se a qualidade do negócio permanecer alta.");
  });

  it("Carry na média ou abaixo não dispara 'Carry elevado'", () => {
    expect(gerarCoachInsight({ ...BASE, carryReal: 0.05, carryComparacaoSetor: "na_media" })).toBeNull();
    expect(gerarCoachInsight({ ...BASE, carryReal: 0.05, carryComparacaoSetor: "abaixo" })).toBeNull();
  });

  it("P/L muito baixo (earnings yield >= 12%) isolado vira o insight literal da spec", () => {
    const r = gerarCoachInsight({ ...BASE, earningsYield: 0.13 });
    expect(r?.titulo).toBe("P/L muito baixo");
    expect(r?.texto).toBe("Preço baixo pode representar oportunidade ou risco. Sempre confirme se a empresa continua saudável antes de concluir que está barata.");
  });

  it("prioridade: ROIC caiu vence Carry elevado quando os dois sinais existem", () => {
    const r = gerarCoachInsight({ ...BASE, roicVariacaoRelativa: -0.2, carryReal: 0.12, carryComparacaoSetor: "acima" });
    expect(r?.titulo).toBe("ROIC caiu");
  });
});
