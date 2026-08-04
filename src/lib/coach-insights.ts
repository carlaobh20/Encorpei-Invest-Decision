import type { ComparacaoSetorial } from "./dash-narrativa";
import { detectarErroClassicoRelacionado } from "./erros-classicos";

/**
 * COACH INSIGHTS (Bloco 2, Sprint 2.7, Investment Coach Layer).
 *
 * "No máximo um insight principal por tela" — esta função devolve UM
 * `CoachInsight | null`, nunca uma lista. Prioridade: erro clássico
 * detectado (mais acionável, "isso pode estar acontecendo agora") > ROIC
 * caiu > Carry acima da média do setor > P/L muito baixo isolado > nada.
 *
 * Nenhum motor novo — só regras (`if`/threshold) sobre valores que o
 * Foundation já calcula (Decision.quality/growth/technical, Carry real,
 * ROIC, Earnings Yield via radar.ts). "Regras decidem" (CLAUDE.md regra 6)
 * aplicado ao pé da letra: nenhuma IA gera este texto, é template fixo.
 */

export type CoachInsight = {
  titulo: string;
  texto: string;
};

export type SinaisCoachInsight = {
  carryReal: number | null;
  carryComparacaoSetor: ComparacaoSetorial;
  roicAtual: number | null;
  /** (atual - anterior) / |anterior| entre as 2 competências DFP mais recentes; null se não há 2 pontos. */
  roicVariacaoRelativa: number | null;
  earningsYield: number | null;
  quality: number | null;
  growth: number | null;
  technical: number | null;
};

/** Mesmo limiar de memory-layer-resultados.ts (LIMIAR_VARIACAO_RELATIVA) — não duplicado como número novo, reaproveitado por precedente. */
const LIMIAR_QUEDA_ROIC = -0.1;
const EARNINGS_YIELD_MUITO_BARATO = 0.12;

function fmtPct(v: number) {
  return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

export function gerarCoachInsight(sinais: SinaisCoachInsight): CoachInsight | null {
  const erroClassico = detectarErroClassicoRelacionado({
    quality: sinais.quality,
    growth: sinais.growth,
    technical: sinais.technical,
    earningsYield: sinais.earningsYield,
  });
  if (erroClassico) {
    return { titulo: erroClassico.erro.nome, texto: `${erroClassico.erro.explicacao} ${erroClassico.porque}` };
  }

  if (sinais.roicVariacaoRelativa !== null && sinais.roicVariacaoRelativa <= LIMIAR_QUEDA_ROIC) {
    return {
      titulo: "ROIC caiu",
      texto: "Uma queda isolada no ROIC nem sempre invalida uma tese. Observe se ela veio acompanhada de piora na geração de caixa e nas margens.",
    };
  }

  if (sinais.carryReal !== null && sinais.carryComparacaoSetor === "acima") {
    return {
      titulo: "Carry elevado",
      texto: `Carry real de IPCA+${fmtPct(sinais.carryReal)}, acima da média do setor hoje. Empresas com Carry elevado tendem a oferecer maior proteção do patrimônio contra inflação, mas isso só cria valor se a qualidade do negócio permanecer alta.`,
    };
  }

  if (sinais.earningsYield !== null && sinais.earningsYield >= EARNINGS_YIELD_MUITO_BARATO) {
    return {
      titulo: "P/L muito baixo",
      texto: "Preço baixo pode representar oportunidade ou risco. Sempre confirme se a empresa continua saudável antes de concluir que está barata.",
    };
  }

  return null;
}
