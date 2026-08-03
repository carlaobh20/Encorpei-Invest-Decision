import { describe, expect, it } from "vitest";
import {
  atr,
  bollinger,
  encontrarPivots,
  ema,
  macd,
  obvSerie,
  roc,
  rsi,
  sma,
  volumeRelativo,
} from "./indicadores";

describe("sma", () => {
  it("calcula a média simples da janela mais recente", () => {
    expect(sma([1, 2, 3, 4, 5], 5)).toBe(3);
    expect(sma([10, 20, 30], 3)).toBe(20);
  });
  it("null quando não há dias suficientes", () => {
    expect(sma([1, 2], 5)).toBeNull();
  });
});

describe("ema", () => {
  it("converge para o valor da série quando ela é constante", () => {
    const closes = Array(30).fill(50);
    expect(ema(closes, 9)).toBeCloseTo(50, 5);
  });
  it("null com dado insuficiente", () => {
    expect(ema([1, 2, 3], 9)).toBeNull();
  });
});

describe("rsi", () => {
  it("100 numa série de alta monotônica pura", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i);
    expect(rsi(closes, 14)).toBe(100);
  });
  it("perto de 0 numa série de baixa monotônica pura", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 - i);
    expect(rsi(closes, 14)).toBeLessThan(5);
  });
  it("perto de 50 numa série que sobe e desce alternadamente pela mesma magnitude", () => {
    const closes = [];
    let v = 100;
    for (let i = 0; i < 20; i++) {
      v += i % 2 === 0 ? 1 : -1;
      closes.push(v);
    }
    const r = rsi(closes, 14)!;
    expect(r).toBeGreaterThan(30);
    expect(r).toBeLessThan(70);
  });
});

describe("macd", () => {
  it("histograma positivo quando a alta está ACELERANDO (não numa reta constante)", () => {
    // reta pura (velocidade constante) faz o histograma convergir a 0 —
    // isso é correto (MACD mede aceleração, não tendência). Uma série
    // quadrática (aceleração real) deve dar histograma > 0.
    const closes = Array.from({ length: 40 }, (_, i) => 100 + 0.02 * i * i);
    const r = macd(closes)!;
    expect(r.histograma).toBeGreaterThan(0);
  });
  it("null com dado insuficiente", () => {
    expect(macd(Array(10).fill(100))).toBeNull();
  });
});

describe("roc", () => {
  it("mede a variação percentual corretamente", () => {
    const closes = Array(25).fill(100);
    closes[24] = 110;
    expect(roc(closes, 21)).toBeCloseTo(0.1, 5);
  });
});

describe("bollinger", () => {
  it("banda superior/inferior simétricas em torno da média numa série constante", () => {
    const b = bollinger(Array(20).fill(50), 20)!;
    expect(b.media).toBe(50);
    expect(b.superior).toBe(50);
    expect(b.inferior).toBe(50);
    expect(b.largura).toBe(0);
  });
});

describe("atr", () => {
  it("maior quando os candles têm range maior", () => {
    const n = 20;
    const closesEstreito = Array(n).fill(100);
    const maxEstreito = Array(n).fill(101);
    const minEstreito = Array(n).fill(99);
    const closesLargo = Array(n).fill(100);
    const maxLargo = Array(n).fill(110);
    const minLargo = Array(n).fill(90);
    const atrEstreito = atr(maxEstreito, minEstreito, closesEstreito, 14)!;
    const atrLargo = atr(maxLargo, minLargo, closesLargo, 14)!;
    expect(atrLargo).toBeGreaterThan(atrEstreito);
  });
  it("null sem máxima/mínima suficientes", () => {
    expect(atr([1, 2], [1, 2], [1, 2], 14)).toBeNull();
  });
});

describe("obvSerie", () => {
  it("acumula volume positivo em alta e negativo em baixa", () => {
    const closes = [10, 11, 10, 12];
    const volumes = [0, 100, 100, 200];
    const s = obvSerie(closes, volumes);
    expect(s).toEqual([0, 100, 0, 200]);
  });
});

describe("volumeRelativo", () => {
  it("maior que 1 quando o volume do dia é maior que a média recente", () => {
    const volumes = [...Array(20).fill(100), 300];
    expect(volumeRelativo(volumes, 20)!).toBeGreaterThan(1);
  });
});

describe("encontrarPivots", () => {
  it("identifica um topo e um fundo claros numa série em V invertido e depois V", () => {
    const maximas = [1, 2, 3, 4, 5, 4, 3, 2, 1, 2, 3, 4, 5];
    const minimas = maximas.map((v) => v - 0.5);
    const pivots = encontrarPivots(maximas, minimas, 2);
    expect(pivots.some((p) => p.tipo === "topo")).toBe(true);
    expect(pivots.some((p) => p.tipo === "fundo")).toBe(true);
  });
});
