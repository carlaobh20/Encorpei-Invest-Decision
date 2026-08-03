import {
  calcularScore,
  ptsEstabilidade,
  ptsMargem,
  ptsValuation,
  type RegraAplicada,
  type ResultadoScore,
} from "./score";
import { modeloDe, type ModeloAnalise } from "./setores";

/**
 * SCORE SETORIAL (versao_algoritmo = 2) — Sector Intelligence Fase B.
 *
 * Regra: cada MODELO DE NEGÓCIO usa as réguas que fazem sentido nele.
 * - FINANCEIRAS (banco, seguradora, infra financeira): qualidade por
 *   ROE + margem; SEM dívida/ROIC industrial (proibidos, testados no CI);
 *   risco = estabilidade das margens; valuation = igual (P/L é universal).
 * - COMMODITIES/CONSTRUÇÃO: mesmas réguas industriais + aviso de ciclo na
 *   decomposição (margem 12m é retrato do ciclo, não estrutura).
 * - DEMAIS: réguas v1 (inalteradas — compatibilidade total).
 * Mudança de pesos/regras = ESTA nova versão; a v1 nunca é editada.
 */

const pct = (v: number) =>
  `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** ROE: bandas próprias (referência banco/seguradora BR). */
export function ptsRoe(r: number): number {
  if (r >= 0.2) return 100;
  if (r >= 0.14) return 70 + ((r - 0.14) / 0.06) * 30;
  if (r >= 0.08) return 40 + ((r - 0.08) / 0.06) * 30;
  return Math.max(0, (r / 0.08) * 40);
}

export type EntradaSetorial = {
  roic: number | null;
  roe: number | null;
  margem_liquida: number | null;
  divida_liquida: number | null;
  patrimonio_liquido: number | null;
  lucro_ltm: number | null;
  market_cap: number | null;
  margens_trimestrais: number[];
};

const FINANCEIRAS: ModeloAnalise[] = ["banco", "seguradora", "infraestrutura_financeira"];
const CICLICAS: ModeloAnalise[] = ["commodities", "construcao"];

export function calcularScorePorModelo(
  ticker: string,
  e: EntradaSetorial
): ResultadoScore & { versao: number; modelo: ModeloAnalise | null } {
  const modelo = modeloDe(ticker);

  // ---------- FINANCEIRAS: réguas próprias ----------
  if (modelo && FINANCEIRAS.includes(modelo)) {
    const dec: RegraAplicada[] = [];
    const q: number[] = [];
    if (e.roe !== null) {
      const p = ptsRoe(e.roe);
      q.push(p);
      dec.push({
        componente: "qualidade",
        regra: "Retorno sobre o patrimônio (ROE, 12m)",
        valor: pct(e.roe),
        pontos: Math.round(p),
      });
    }
    if (e.margem_liquida !== null) {
      const p = ptsMargem(e.margem_liquida);
      q.push(p);
      dec.push({
        componente: "qualidade",
        regra: "Margem líquida",
        valor: pct(e.margem_liquida),
        pontos: Math.round(p),
      });
    }
    const qualidade = q.length ? q.reduce((a, b) => a + b, 0) / q.length : null;

    let valuation: number | null = null;
    if (e.lucro_ltm !== null && e.market_cap !== null && e.market_cap > 0) {
      const ey = e.lucro_ltm / e.market_cap;
      valuation = ptsValuation(ey);
      dec.push({
        componente: "valuation",
        regra: "Rendimento do lucro (lucro 12m ÷ valor de mercado)",
        valor: pct(ey),
        pontos: Math.round(valuation),
      });
    }

    let risco: number | null = null;
    if (e.margens_trimestrais.length >= 3) {
      const ms = e.margens_trimestrais;
      const med = ms.reduce((a, b) => a + b, 0) / ms.length;
      const sd = Math.sqrt(ms.reduce((a, b) => a + (b - med) ** 2, 0) / ms.length);
      risco = ptsEstabilidade(sd);
      dec.push({
        componente: "risco",
        regra: "Estabilidade dos resultados (últimos trimestres)",
        valor: `oscilação de ${pct(sd)}`,
        pontos: Math.round(risco),
      });
    }

    const pesos: [number | null, number][] = [
      [qualidade, 0.45],
      [valuation, 0.3],
      [risco, 0.25],
    ];
    const presentes = pesos.filter(([v]) => v !== null) as [number, number][];
    const soma = presentes.reduce((a, [, w]) => a + w, 0);
    const score_final = presentes.length
      ? presentes.reduce((a, [v, w]) => a + v * (w / soma), 0)
      : 0;
    const confianca =
      presentes.length === 3 ? "alta" : presentes.length === 2 ? "media" : "baixa";

    return {
      qualidade: qualidade !== null ? Math.round(qualidade) : null,
      valuation: valuation !== null ? Math.round(valuation) : null,
      risco: risco !== null ? Math.round(risco) : null,
      score_final: Math.round(score_final),
      confianca,
      decomposicao: dec,
      versao: 2,
      modelo,
    };
  }

  // ---------- demais modelos: réguas v1 (+ aviso de ciclo) ----------
  const base = calcularScore({
    roic: e.roic,
    margem_liquida: e.margem_liquida,
    divida_liquida: e.divida_liquida,
    patrimonio_liquido: e.patrimonio_liquido,
    lucro_ltm: e.lucro_ltm,
    market_cap: e.market_cap,
    margens_trimestrais: e.margens_trimestrais,
  });
  if (modelo && CICLICAS.includes(modelo)) {
    base.decomposicao.push({
      componente: "risco",
      regra: "Aviso de ciclo (setor cíclico)",
      valor: "margens 12m refletem o momento do ciclo, não a estrutura",
      pontos: 0,
    });
  }
  return { ...base, versao: 2, modelo };
}
