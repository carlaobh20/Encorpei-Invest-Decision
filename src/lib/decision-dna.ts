import type { DecisaoAvaliada } from "./decision-history";

/**
 * DECISION DNA (Foundation v3 — Módulo 7).
 *
 * Diferente de `decision-history.ts` (que julga UMA decisão: o preço foi a
 * favor ou contra), o Decision DNA agrega VÁRIAS decisões já julgadas para
 * responder: quando um certo fator estava presente (ex.: "Confluence
 * convicção = alta", "Carry faixa = alta"), as decisões deram certo com que
 * frequência?
 *
 * Regra inegociável da especificação, repetida aqui de propósito: "nunca
 * altera pesos, só registra". Este módulo NUNCA realimenta Score, Carry ou
 * Confluence — não existe nenhum caminho de código daqui para lá. É
 * observação pura, para leitura humana (Carlos decide se e como usar).
 *
 * Corte honesto: com poucas decisões registradas no Diário hoje (ver
 * roadmap/status-execucao.md), a maioria dos fatores vai aparecer com
 * `taxaAFavor: null` (observações insuficientes) — comportamento correto,
 * não bug. Reportar uma taxa sobre 1-2 decisões seria estatisticamente
 * inútil e enganoso.
 */

export type FatorObservado = {
  /** ex.: "confluenceConviccao", "carryFaixa", "statusTese" */
  chave: string;
  /** ex.: "alta", "media", "baixa" */
  valor: string;
};

export type DecisaoComFatores = DecisaoAvaliada & {
  fatores: FatorObservado[];
};

/** Mínimo de observações confiáveis antes de reportar uma taxa — abaixo disso, null. */
export const MIN_OBS_FATOR = 3;

export type ResumoFator = {
  chave: string;
  valor: string;
  observacoes: number; // só decisões confiáveis (≥30 dias) e direcionais (a_favor/contra)
  aFavor: number;
  contra: number;
  taxaAFavor: number | null;
  explicacao: string;
};

function chaveComposta(f: FatorObservado): string {
  return `${f.chave}::${f.valor}`;
}

/**
 * Agrega decisões já julgadas por fator presente no momento da decisão.
 * Função pura — apenas conta e resume, nunca decide nem realimenta pesos.
 */
export function resumirFatores(decisoes: DecisaoComFatores[]): ResumoFator[] {
  const contagem = new Map<string, { chave: string; valor: string; aFavor: number; contra: number }>();

  for (const d of decisoes) {
    if (!d.confiavel) continue;
    if (d.julgamento !== "a_favor" && d.julgamento !== "contra") continue;

    for (const fator of d.fatores) {
      const key = chaveComposta(fator);
      const atual = contagem.get(key) ?? { chave: fator.chave, valor: fator.valor, aFavor: 0, contra: 0 };
      if (d.julgamento === "a_favor") atual.aFavor++;
      else atual.contra++;
      contagem.set(key, atual);
    }
  }

  const resumos: ResumoFator[] = Array.from(contagem.values()).map((c) => {
    const observacoes = c.aFavor + c.contra;
    const taxaAFavor = observacoes >= MIN_OBS_FATOR ? c.aFavor / observacoes : null;
    const explicacao =
      taxaAFavor === null
        ? `${c.chave} = "${c.valor}": só ${observacoes} observação(ões) confiável(is) até agora — abaixo do mínimo de ${MIN_OBS_FATOR}, sem taxa reportável.`
        : `${c.chave} = "${c.valor}": ${(taxaAFavor * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% das ${observacoes} decisões confiáveis com esse fator tiveram o preço a favor. Observação histórica — nunca altera pesos de Score, Carry ou Confluence.`;
    return {
      chave: c.chave,
      valor: c.valor,
      observacoes,
      aFavor: c.aFavor,
      contra: c.contra,
      taxaAFavor,
      explicacao,
    };
  });

  return resumos.sort((a, b) => b.observacoes - a.observacoes || a.chave.localeCompare(b.chave));
}
