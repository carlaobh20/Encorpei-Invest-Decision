import { describe, expect, it } from "vitest";
import {
  resolverPesoEvidencia,
  resolverPesosEvidencias,
  resumirPoderPreditivoEvidencias,
  CHAVE_FATOR_EVIDENCIA,
  PESO_PADRAO,
  type PropostaPesoEvidencia,
} from "./evidence-weight";
import { MIN_OBS_FATOR, type DecisaoComFatores } from "./decision-dna";
import type { Julgamento } from "./decision-history";

function proposta(over: Partial<PropostaPesoEvidencia>): PropostaPesoEvidencia {
  return {
    categoria: "margem",
    hipoteseId: 1,
    aprovacaoId: 1,
    pesoProposto: 1.3,
    aprovado: true,
    aprovadoPor: "Carlos",
    aprovadoEm: "2026-08-01T00:00:00Z",
    justificativa: "teste",
    ...over,
  };
}

function decisao(julgamento: Julgamento, confiavel: boolean, fatores: { chave: string; valor: string }[]): DecisaoComFatores {
  return {
    id: 1,
    ticker: "TEST3",
    decisao: "comprei",
    justificativa: "teste",
    criadoEm: "2026-01-01T00:00:00Z",
    precoNaDecisao: 10,
    precoAtual: 11,
    variacaoPct: 0.1,
    diasDecorridos: 60,
    julgamento,
    explicacaoJulgamento: "teste",
    confiavel,
    fatores,
  };
}

describe("resolverPesoEvidencia", () => {
  it("sem nenhuma proposta: peso padrão neutro, origem padrao", () => {
    const r = resolverPesoEvidencia("margem", []);
    expect(r.peso).toBe(PESO_PADRAO);
    expect(r.origem).toBe("padrao");
  });

  it("proposta pendente (aprovado null): não altera o peso, continua padrão", () => {
    const r = resolverPesoEvidencia("margem", [proposta({ aprovado: null })]);
    expect(r.peso).toBe(PESO_PADRAO);
    expect(r.origem).toBe("padrao");
  });

  it("proposta rejeitada (aprovado false): não altera o peso", () => {
    const r = resolverPesoEvidencia("margem", [proposta({ aprovado: false })]);
    expect(r.peso).toBe(PESO_PADRAO);
  });

  it("aprovado=true mas sem aprovadoPor: tratado como não aprovado, por segurança (regra da migração 019)", () => {
    const r = resolverPesoEvidencia("margem", [proposta({ aprovado: true, aprovadoPor: null })]);
    expect(r.peso).toBe(PESO_PADRAO);
    expect(r.origem).toBe("padrao");
    expect(r.motivo).toContain("sem aprovado_por");
  });

  it("proposta aprovada e identificada: peso vem da proposta, origem aprovado_erl", () => {
    const r = resolverPesoEvidencia("margem", [proposta({ pesoProposto: 1.5, aprovadoPor: "Carlos" })]);
    expect(r.peso).toBe(1.5);
    expect(r.origem).toBe("aprovado_erl");
    expect(r.aprovadoPor).toBe("Carlos");
    expect(r.motivo).toContain("Carlos");
  });

  it("duas propostas aprovadas para a mesma categoria: usa a mais recente por aprovadoEm", () => {
    const antiga = proposta({ aprovacaoId: 1, pesoProposto: 1.1, aprovadoEm: "2026-01-01T00:00:00Z" });
    const nova = proposta({ aprovacaoId: 2, pesoProposto: 1.4, aprovadoEm: "2026-08-01T00:00:00Z" });
    const r = resolverPesoEvidencia("margem", [antiga, nova]);
    expect(r.peso).toBe(1.4);
    expect(r.aprovacaoId).toBe(2);
  });

  it("duas propostas aprovadas, ordem invertida (a mais recente vem primeiro na lista): resultado é o mesmo", () => {
    const antiga = proposta({ aprovacaoId: 1, pesoProposto: 1.1, aprovadoEm: "2026-01-01T00:00:00Z" });
    const nova = proposta({ aprovacaoId: 2, pesoProposto: 1.4, aprovadoEm: "2026-08-01T00:00:00Z" });
    const r = resolverPesoEvidencia("margem", [nova, antiga]);
    expect(r.peso).toBe(1.4);
    expect(r.aprovacaoId).toBe(2);
  });

  it("só uma das propostas tem aprovadoEm: a que tem data vence, independente da ordem", () => {
    const semData = proposta({ aprovacaoId: 1, pesoProposto: 1.1, aprovadoEm: null });
    const comData = proposta({ aprovacaoId: 2, pesoProposto: 1.4, aprovadoEm: "2026-08-01T00:00:00Z" });
    expect(resolverPesoEvidencia("margem", [semData, comData]).peso).toBe(1.4);
    expect(resolverPesoEvidencia("margem", [comData, semData]).peso).toBe(1.4);
  });

  it("nenhuma proposta válida tem aprovadoEm: desempate cai para o maior aprovacaoId", () => {
    const p1 = proposta({ aprovacaoId: 1, pesoProposto: 1.1, aprovadoEm: null });
    const p2 = proposta({ aprovacaoId: 2, pesoProposto: 1.4, aprovadoEm: null });
    const r = resolverPesoEvidencia("margem", [p1, p2]);
    expect(r.peso).toBe(1.4);
    expect(r.aprovacaoId).toBe(2);
  });

  it("mistura de proposta aprovada sem aprovadoPor e outra corretamente aprovada: só a identificada conta, motivo reflete a válida", () => {
    const semIdentificacao = proposta({ aprovacaoId: 1, pesoProposto: 9.9, aprovado: true, aprovadoPor: null });
    const valida = proposta({ aprovacaoId: 2, pesoProposto: 1.4, aprovado: true, aprovadoPor: "Carlos" });
    const r = resolverPesoEvidencia("margem", [semIdentificacao, valida]);
    expect(r.peso).toBe(1.4);
    expect(r.origem).toBe("aprovado_erl");
  });

  it("categoria diferente não interfere no resultado", () => {
    const r = resolverPesoEvidencia("margem", [proposta({ categoria: "roic", pesoProposto: 2.0 })]);
    expect(r.peso).toBe(PESO_PADRAO);
  });
});

describe("resolverPesosEvidencias", () => {
  it("resolve múltiplas categorias de uma vez, cada uma independente", () => {
    const propostas = [proposta({ categoria: "margem", pesoProposto: 1.2 }), proposta({ categoria: "roic", pesoProposto: 0.9 })];
    const r = resolverPesosEvidencias(["margem", "roic", "receita"], propostas);
    expect(r.find((x) => x.categoria === "margem")!.peso).toBe(1.2);
    expect(r.find((x) => x.categoria === "roic")!.peso).toBe(0.9);
    expect(r.find((x) => x.categoria === "receita")!.peso).toBe(PESO_PADRAO);
  });
});

describe("resumirPoderPreditivoEvidencias", () => {
  it("reaproveita resumirFatores (decision-dna.ts) filtrando só a chave de evidência", () => {
    const fatorEvidencia = { chave: CHAVE_FATOR_EVIDENCIA, valor: "margem" };
    const outroFator = { chave: "confluenceConviccao", valor: "alta" };
    const decisoes = Array.from({ length: MIN_OBS_FATOR }, () => decisao("a_favor", true, [fatorEvidencia, outroFator]));
    const r = resumirPoderPreditivoEvidencias(decisoes);
    expect(r).toHaveLength(1);
    expect(r[0].chave).toBe(CHAVE_FATOR_EVIDENCIA);
    expect(r[0].valor).toBe("margem");
    expect(r[0].taxaAFavor).toBe(1);
  });

  it("nunca realimenta peso — resumo é puramente observacional", () => {
    const fatorEvidencia = { chave: CHAVE_FATOR_EVIDENCIA, valor: "roic" };
    const decisoes = Array.from({ length: MIN_OBS_FATOR }, () => decisao("contra", true, [fatorEvidencia]));
    const r = resumirPoderPreditivoEvidencias(decisoes);
    expect(r[0].explicacao).toContain("nunca altera pesos");
  });
});
