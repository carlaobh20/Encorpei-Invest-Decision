import type { DecisaoAvaliada } from "./decision-history";

/**
 * PROBABILITY ENGINE (Foundation v3 — Módulo 3).
 *
 * A especificação pede que toda decisão responda três perguntas — nunca só
 * uma nota: qual a probabilidade histórica (de o preço ter ido a favor da
 * direção da decisão), qual o nível de confiança nesse número, e sobre
 * quantas observações ele foi calculado.
 *
 * Reaproveita 100% o julgamento já feito por `avaliarDecisoes`
 * (decision-history.ts) — este módulo não julga preço de novo, só agrega.
 * Função pura: quem chama decide o escopo (uma empresa, um fator, a
 * carteira inteira) passando a lista de `DecisaoAvaliada` já filtrada.
 *
 * Corte honesto: hoje o Diário (/diario) tem pouquíssimas decisões
 * registradas (ver roadmap/status-execucao.md). Isso significa que este
 * motor vai reportar `confiabilidade: "insuficiente"` na maioria dos casos
 * por um bom tempo — é o comportamento CORRETO, não um bug. Uma
 * probabilidade calculada sobre 1-2 observações seria estatisticamente
 * inútil e enganosa se apresentada como se fosse confiável.
 */

export type ConfiabilidadeProbabilidade = "insuficiente" | "baixa" | "media" | "alta";

export const ROTULO_CONFIABILIDADE_PROBABILIDADE: Record<ConfiabilidadeProbabilidade, string> = {
  insuficiente: "Observações insuficientes",
  baixa: "Confiabilidade baixa",
  media: "Confiabilidade média",
  alta: "Confiabilidade alta",
};

/**
 * Limiares de nº de observações (decisões confiáveis ≥30 dias, com
 * julgamento direcional a_favor/contra) para cada nível de confiabilidade.
 * Números iniciais do Bloco 1 — calibrar quando o Diário acumular histórico
 * real; documentado aqui, não escondido em código.
 */
export const LIMIARES_CONFIABILIDADE = {
  baixa: 5, // < 5 observações → insuficiente
  media: 15, // < 15 → baixa
  alta: 40, // < 40 → média; >= 40 → alta
} as const;

export type BaseEstatisticaProbabilidade = {
  observacoes: number; // só as direcionais e confiáveis (a_favor + contra)
  aFavor: number;
  contra: number;
  neutro: number; // informativo — não entra no cálculo de probabilidade
  descartadasPoucoTempo: number; // confiavel === false — não entram
  descartadasSemPreco: number; // julgamento === "indisponivel" — não entram
};

export type ResultadoProbabilidade = {
  probabilidade: number | null; // 0-1, fração a_favor sobre (a_favor+contra)
  confiabilidade: ConfiabilidadeProbabilidade;
  baseEstatistica: BaseEstatisticaProbabilidade;
  explicacao: string;
};

function classificarConfiabilidadeProbabilidade(observacoes: number): ConfiabilidadeProbabilidade {
  if (observacoes < LIMIARES_CONFIABILIDADE.baixa) return "insuficiente";
  if (observacoes < LIMIARES_CONFIABILIDADE.media) return "baixa";
  if (observacoes < LIMIARES_CONFIABILIDADE.alta) return "media";
  return "alta";
}

export function calcularProbabilidade(decisoes: DecisaoAvaliada[]): ResultadoProbabilidade {
  let aFavor = 0;
  let contra = 0;
  let neutro = 0;
  let descartadasPoucoTempo = 0;
  let descartadasSemPreco = 0;

  for (const d of decisoes) {
    if (!d.confiavel) {
      descartadasPoucoTempo++;
      continue;
    }
    if (d.julgamento === "indisponivel") {
      descartadasSemPreco++;
      continue;
    }
    if (d.julgamento === "a_favor") aFavor++;
    else if (d.julgamento === "contra") contra++;
    else neutro++; // "neutro": informativo, sem direção — não entra no denominador
  }

  const observacoes = aFavor + contra;
  const probabilidade = observacoes > 0 ? aFavor / observacoes : null;
  const confiabilidade = classificarConfiabilidadeProbabilidade(observacoes);

  const baseEstatistica: BaseEstatisticaProbabilidade = {
    observacoes,
    aFavor,
    contra,
    neutro,
    descartadasPoucoTempo,
    descartadasSemPreco,
  };

  const explicacao =
    probabilidade === null
      ? `Nenhuma decisão direcional confiável (≥30 dias, com julgamento a_favor/contra) ainda — sem base pra estimar probabilidade. ${
          descartadasPoucoTempo > 0 ? `${descartadasPoucoTempo} decisão(ões) esperando completar 30 dias.` : ""
        }`.trim()
      : `${(probabilidade * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% das ${observacoes} decisão(ões) direcional(is) e confiável(is) tiveram o preço a favor. ${ROTULO_CONFIABILIDADE_PROBABILIDADE[confiabilidade]} — não é garantia de resultado futuro, é frequência histórica sobre uma base ainda pequena.`;

  return { probabilidade, confiabilidade, baseEstatistica, explicacao };
}
