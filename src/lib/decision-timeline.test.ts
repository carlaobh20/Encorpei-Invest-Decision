import { describe, expect, it } from "vitest";
import {
  detectarMudancaCarry,
  detectarMudancaConfluence,
  detectarMudancaNota,
  detectarMudancaTecnica,
  detectarNovoBalanco,
  LIMIARES_TIMELINE,
} from "./decision-timeline";

describe("detectarMudancaNota", () => {
  it("null em qualquer lado: sem evento (nunca compara com dado ausente)", () => {
    expect(detectarMudancaNota("INTB3", null, 80)).toBeNull();
    expect(detectarMudancaNota("INTB3", 80, null)).toBeNull();
  });

  it("variação abaixo do limiar: sem evento (evita ruído)", () => {
    expect(detectarMudancaNota("INTB3", 80, 82)).toBeNull();
  });

  it("variação igual/acima do limiar: evento com detalhe e explicação", () => {
    const ev = detectarMudancaNota("INTB3", 70, 80);
    expect(ev?.tipo).toBe("mudanca_nota");
    expect(ev?.detalhe).toMatchObject({ ticker: "INTB3", anterior: 70, atual: 80, diff: 10 });
    expect(ev?.explicacao).toContain("70");
    expect(ev?.explicacao).toContain("80");
  });

  it("limiar customizado é respeitado", () => {
    expect(detectarMudancaNota("INTB3", 70, 73, 5)).toBeNull();
    expect(detectarMudancaNota("INTB3", 70, 76, 5)).not.toBeNull();
  });
});

describe("detectarMudancaConfluence", () => {
  it("segue a mesma régua de limiar da nota", () => {
    expect(detectarMudancaConfluence("INTB3", 60, 64)).toBeNull();
    expect(detectarMudancaConfluence("INTB3", 60, 70)?.tipo).toBe("mudanca_confluence");
  });
});

describe("detectarMudancaCarry", () => {
  it("variação abaixo de 1pp: sem evento", () => {
    expect(detectarMudancaCarry("INTB3", 0.06, 0.065)).toBeNull();
  });

  it("variação de 2pp: evento com carry formatado em %", () => {
    const ev = detectarMudancaCarry("INTB3", 0.06, 0.08);
    expect(ev?.tipo).toBe("mudanca_carry");
    expect(ev?.explicacao).toContain("IPCA +");
  });
});

describe("detectarMudancaTecnica", () => {
  it("respeita o limiar padrão de 10 pontos", () => {
    expect(detectarMudancaTecnica("INTB3", 50, 58)).toBeNull();
    expect(detectarMudancaTecnica("INTB3", 50, 62)?.tipo).toBe("mudanca_tecnica");
  });
});

describe("detectarNovoBalanco", () => {
  it("mesma competência: sem evento", () => {
    expect(detectarNovoBalanco("INTB3", "2026-06-30", "2026-06-30")).toBeNull();
  });

  it("competência nova: evento", () => {
    const ev = detectarNovoBalanco("INTB3", "2026-03-31", "2026-06-30");
    expect(ev?.tipo).toBe("novo_balanco");
    expect(ev?.explicacao).toContain("2026-03-31");
    expect(ev?.explicacao).toContain("2026-06-30");
  });

  it("primeiro balanço conhecido (anterior null): ainda gera evento", () => {
    const ev = detectarNovoBalanco("INTB3", null, "2026-06-30");
    expect(ev?.tipo).toBe("novo_balanco");
    expect(ev?.explicacao).toContain("Primeiro balanço");
  });
});

describe("LIMIARES_TIMELINE", () => {
  it("todos os limiares são positivos (nunca zero — evita evento a cada casa decimal)", () => {
    expect(LIMIARES_TIMELINE.nota).toBeGreaterThan(0);
    expect(LIMIARES_TIMELINE.confluence).toBeGreaterThan(0);
    expect(LIMIARES_TIMELINE.carry).toBeGreaterThan(0);
    expect(LIMIARES_TIMELINE.tecnica).toBeGreaterThan(0);
  });
});
