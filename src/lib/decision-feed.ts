/**
 * DECISION FEED — PIC 01 (03/08/2026).
 *
 * "O QUE FAZER HOJE" por posição, 100% por REGRAS explícitas (CLAUDE.md
 * regra 6: regras decidem, IA explica — nunca o contrário). Reusa o que já
 * existe (status da tese, Tese Técnica do motor Technical, direção
 * predominante do Carry) — nenhum dado novo, nenhuma nota nova.
 *
 * Vocabulário travado por design e testado: NUNCA "comprar"/"vender"/
 * "compre"/"venda" — mesma regra 7 do CLAUDE.md que já vale pro resto do
 * sistema. Os rótulos possíveis são só os quatro abaixo.
 */

import type { TeseTecnica } from "./technical/types";

export type StatusTese = "valida" | "em_revisao" | "quebrada";
export type SugestaoFeed = "aumentar_prioridade" | "reduzir_prioridade" | "aguardar_melhor_ponto" | "nenhuma_acao";

export const ROTULO_SUGESTAO: Record<SugestaoFeed, string> = {
  aumentar_prioridade: "Aumentar prioridade",
  reduzir_prioridade: "Reduzir prioridade",
  aguardar_melhor_ponto: "Aguardar melhor ponto",
  nenhuma_acao: "Nenhuma ação necessária",
};

export type DecisionFeedEntrada = {
  ticker: string;
  nome: string;
  statusTese: StatusTese | null;
  teseTecnica: TeseTecnica | null;
  timingFavoravel: boolean | null; // Excelente/Bom = true, Ruim/Muito ruim = false, Neutro = null
  fraseTiming: string | null;
};

export type DecisionFeedItem = {
  ticker: string;
  nome: string;
  sugestao: SugestaoFeed;
  explicacao: string;
};

export function gerarDecisionFeed(entradas: DecisionFeedEntrada[]): DecisionFeedItem[] {
  return entradas.map((e) => {
    // 1) tese fundamentalista quebrada domina qualquer leitura de gráfico
    if (e.statusTese === "quebrada") {
      return {
        ticker: e.ticker,
        nome: e.nome,
        sugestao: "reduzir_prioridade",
        explicacao: "A tese fundamentalista quebrou — a premissa original não se sustenta mais, independente do que o gráfico mostra agora.",
      };
    }
    // 2) tese em revisão: pede espera até a poeira baixar
    if (e.statusTese === "em_revisao") {
      return {
        ticker: e.ticker,
        nome: e.nome,
        sugestao: "aguardar_melhor_ponto",
        explicacao: "A tese está em revisão (um gatilho disparou recentemente) — vale entender a causa antes de qualquer prioridade nova.",
      };
    }
    // 3) tese válida, mas o gráfico não confirma: aguardar melhor ponto de entrada/saída
    if (e.statusTese === "valida" && e.teseTecnica === "nao") {
      return {
        ticker: e.ticker,
        nome: e.nome,
        sugestao: "aguardar_melhor_ponto",
        explicacao: `A tese continua de pé nos fundamentos, mas o gráfico não confirma o timing agora${e.fraseTiming ? ` (${e.fraseTiming})` : ""} — aguardar um ponto melhor de entrada.`,
      };
    }
    // 4) tese válida + gráfico confirma + timing favorável: maior convicção no momento
    if (e.statusTese === "valida" && e.teseTecnica === "sim" && e.timingFavoravel === true) {
      return {
        ticker: e.ticker,
        nome: e.nome,
        sugestao: "aumentar_prioridade",
        explicacao: `Tese sólida e o gráfico confirma o timing${e.fraseTiming ? ` (${e.fraseTiming})` : ""} — momento de maior convicção para esta posição.`,
      };
    }
    // 5) tudo o mais (parcial, sem tese técnica ainda, timing neutro etc.): sem gatilho pra mudar prioridade
    return {
      ticker: e.ticker,
      nome: e.nome,
      sugestao: "nenhuma_acao",
      explicacao: "Sem sinal forte o bastante (dos fundamentos ou do gráfico) para mudar a prioridade desta posição agora.",
    };
  });
}
