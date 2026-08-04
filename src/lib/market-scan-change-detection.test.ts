import { describe, expect, it } from "vitest";
import {
  detectarMudancaTese,
  detectarMudancaCarryV1,
  detectarMudancaQualityViaRoic,
  detectarMudancaSnapshotV2,
  detectarMudancaPorEvidencia,
  detectarMudancaFluxo,
  detectarMudancaDividendos,
} from "./market-scan-change-detection";

describe("detectarMudancaTese", () => {
  it("sem eventos para o ticker: null", () => {
    expect(detectarMudancaTese("AAAA3", [])).toBeNull();
  });

  it("mudança de status vira evento disponível, direção neutra", () => {
    const r = detectarMudancaTese("AAAA3", [
      { ticker: "AAAA3", tipo: "mudanca_status", criado_em: "2026-08-05T10:00:00Z", descricao: "Tese confirmada" },
    ]);
    expect(r?.disponivel).toBe(true);
    expect(r?.direcao).toBe("neutro");
  });

  it("gatilho disparado vira direção 'piorou'", () => {
    const r = detectarMudancaTese("AAAA3", [
      { ticker: "AAAA3", tipo: "gatilho_disparado", criado_em: "2026-08-05T10:00:00Z", descricao: "ROIC caiu abaixo do limite" },
    ]);
    expect(r?.direcao).toBe("piorou");
  });

  it("eventos de outros tickers são ignorados", () => {
    expect(detectarMudancaTese("AAAA3", [{ ticker: "BBBB3", tipo: "mudanca_status", criado_em: "x" }])).toBeNull();
  });
});

describe("detectarMudancaCarryV1", () => {
  it("delta abaixo do limiar: sem evento", () => {
    expect(detectarMudancaCarryV1("AAAA3", 0.08, 0.081)).toBeNull();
  });

  it("delta positivo relevante: melhorou", () => {
    const r = detectarMudancaCarryV1("AAAA3", 0.05, 0.09);
    expect(r?.direcao).toBe("melhorou");
  });

  it("delta negativo relevante: piorou", () => {
    const r = detectarMudancaCarryV1("AAAA3", 0.09, 0.05);
    expect(r?.direcao).toBe("piorou");
  });

  it("qualquer lado null: sem evento, nunca fabrica", () => {
    expect(detectarMudancaCarryV1("AAAA3", null, 0.09)).toBeNull();
    expect(detectarMudancaCarryV1("AAAA3", 0.09, null)).toBeNull();
  });
});

describe("detectarMudancaQualityViaRoic", () => {
  it("variação abaixo do piso: sem evento", () => {
    expect(detectarMudancaQualityViaRoic("AAAA3", 0.2, 0.205)).toBeNull();
  });

  it("variação relevante positiva: melhorou", () => {
    const r = detectarMudancaQualityViaRoic("AAAA3", 0.1, 0.15);
    expect(r?.direcao).toBe("melhorou");
  });

  it("variação relevante negativa: piorou", () => {
    const r = detectarMudancaQualityViaRoic("AAAA3", 0.2, 0.1);
    expect(r?.direcao).toBe("piorou");
  });

  it("ROIC anterior zero: sem evento (divisão por zero evitada)", () => {
    expect(detectarMudancaQualityViaRoic("AAAA3", 0, 0.1)).toBeNull();
  });
});

describe("detectarMudancaSnapshotV2", () => {
  it("sem captura anterior: indisponível com motivo específico", () => {
    const r = detectarMudancaSnapshotV2("AAAA3", "growth", null, 70);
    expect(r.disponivel).toBe(false);
    expect(r.motivo).toContain("024");
  });

  it("com captura anterior e hoje: melhorou/piorou calculado normalmente", () => {
    const melhorou = detectarMudancaSnapshotV2("AAAA3", "conviccao", 50, 70);
    expect(melhorou.disponivel).toBe(true);
    expect(melhorou.direcao).toBe("melhorou");
    const piorou = detectarMudancaSnapshotV2("AAAA3", "conviccao", 70, 50);
    expect(piorou.direcao).toBe("piorou");
  });

  it("sem mudança: direção neutra", () => {
    const r = detectarMudancaSnapshotV2("AAAA3", "tecnica", 60, 60);
    expect(r.direcao).toBe("neutro");
  });
});

describe("detectarMudancaPorEvidencia", () => {
  it("sem evidências novas relevantes: indisponível com motivo do coletor", () => {
    const r = detectarMudancaPorEvidencia("AAAA3", "guidance", []);
    expect(r.disponivel).toBe(false);
    expect(r.motivo).toContain("coletor");
  });

  it("evidência nova de guidance: disponível", () => {
    const r = detectarMudancaPorEvidencia("AAAA3", "guidance", [
      { ticker: "AAAA3", categoria: "guidance", descricao: "Guidance revisado para cima", criado_em: "x" },
    ]);
    expect(r.disponivel).toBe(true);
    expect(r.texto).toContain("Guidance");
  });

  it("evidência de outra categoria não conta pra dimensão errada", () => {
    const r = detectarMudancaPorEvidencia("AAAA3", "guidance", [
      { ticker: "AAAA3", categoria: "macro_focus", descricao: "Focus mudou", criado_em: "x" },
    ]);
    expect(r.disponivel).toBe(false);
  });
});

describe("dimensões sem fonte nenhuma hoje", () => {
  it("fluxo sempre indisponível, com motivo explícito de estrutura preparada", () => {
    const r = detectarMudancaFluxo("AAAA3");
    expect(r.disponivel).toBe(false);
    expect(r.motivo).toContain("preparada");
  });

  it("dividendos sempre indisponível, nunca fabricado", () => {
    const r = detectarMudancaDividendos("AAAA3");
    expect(r.disponivel).toBe(false);
    expect(r.motivo).toContain("não rastreia");
  });
});
