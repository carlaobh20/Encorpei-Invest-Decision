/**
 * BIBLIOTECA DE ERROS CLÁSSICOS (Bloco 2, Sprint 2.7, Investment Coach
 * Layer — Módulo "Erros Clássicos").
 *
 * A spec dá 5 exemplos literais. Cada um só entra no matcher (detecção
 * automática "isso pode estar acontecendo agora com esta empresa") quando
 * existe um campo REAL já calculado pra sustentar a comparação — nunca um
 * limiar inventado sem precedente no código. Limiares usados aqui:
 *
 * - `earningsYield` (inverso de P/L): 0.05 e 0.12 são os MESMOS breakpoints
 *   já usados em `score.ts` (`ptsValuation`) pra separar "caro"/"neutro"/
 *   "muito barato" — reaproveitados, não inventados.
 * - `quality`/`growth`/`technical` (0-100, componentes do Confluence v2,
 *   `decision-object.ts`): o corte "baixo" (<40) / "alto" (>=70) é uma
 *   heurística EDITORIAL — mesmo tipo de corte já registrado como tal em
 *   `decisoes-prioritarias.ts` (tempo estimado de leitura), documentado
 *   aqui, não escondido.
 *
 * "Olhar apenas Dividend Yield" fica SEM matcher: o sistema não calcula
 * Dividend Yield hoje em nenhum lugar (ver `truth-indicator-history.ts`,
 * `dividend_yield` já está lá como "sem série persistida"). Continua na
 * biblioteca como conteúdo educativo — nunca relacionado a um caso real
 * que o sistema não pode verificar.
 */

export type ErroClassico = {
  id: string;
  nome: string;
  explicacao: string;
};

export const BIBLIOTECA_ERROS_CLASSICOS: ErroClassico[] = [
  {
    id: "comprar_caro",
    nome: "Comprar empresa boa em preço ruim",
    explicacao: "Uma empresa de qualidade alta ainda pode ser uma má compra se o preço já embute todo o otimismo — qualidade não é sinônimo de barato.",
  },
  {
    id: "crescimento_sem_qualidade",
    nome: "Confundir crescimento com qualidade",
    explicacao: "Crescer não é o mesmo que crescer bem — vale checar se o crescimento vem com ROIC e margens sustentáveis, não só receita maior.",
  },
  {
    id: "so_dividend_yield",
    nome: "Olhar apenas Dividend Yield",
    explicacao: "Um yield alto pode ser sustentável ou pode ser o mercado precificando um corte de dividendo já esperado — o yield sozinho não distingue os dois casos.",
  },
  {
    id: "so_pl",
    nome: "Olhar apenas P/L",
    explicacao: "P/L baixo pode ser oportunidade ou pode ser o mercado corretamente descontando uma deterioração — confirme a saúde do negócio antes de concluir que está barato.",
  },
  {
    id: "so_tecnica",
    nome: "Olhar apenas análise técnica",
    explicacao: "Um sinal técnico forte sem fundamento por trás tende a reverter mais rápido — técnica ajuda a cronometrar uma tese, não substitui ter uma.",
  },
];

/** Heurística editorial (não medição) — mesmo espírito do corte em decisoes-prioritarias.ts. */
const QUALIDADE_BAIXA = 40;
const QUALIDADE_ALTA = 70;
const TECNICO_ALTO = 70;
const CRESCIMENTO_ALTO = 70;
/** Mesmos breakpoints de score.ts (ptsValuation) — não inventados aqui. */
const EARNINGS_YIELD_CARO = 0.05;
const EARNINGS_YIELD_MUITO_BARATO = 0.12;

export type SinaisErroClassico = {
  quality: number | null;
  growth: number | null;
  technical: number | null;
  earningsYield: number | null;
};

function buscar(id: string): ErroClassico {
  const erro = BIBLIOTECA_ERROS_CLASSICOS.find((e) => e.id === id);
  if (!erro) throw new Error(`Erro clássico desconhecido: ${id}`);
  return erro;
}

/**
 * Detecta, entre os erros com matcher real, se algum se relaciona ao caso
 * atual — retorna no máximo UM (o mais específico primeiro), nunca vários
 * de uma vez, pra não virar lista de avisos. `null` se nenhum sinal bate.
 */
export function detectarErroClassicoRelacionado(sinais: SinaisErroClassico): { erro: ErroClassico; porque: string } | null {
  const { quality, growth, technical, earningsYield } = sinais;

  if (technical !== null && technical >= TECNICO_ALTO && quality !== null && quality < QUALIDADE_BAIXA) {
    return {
      erro: buscar("so_tecnica"),
      porque: `Technical em ${technical} mas Quality em ${quality} — o sinal técnico está descolado do fundamento.`,
    };
  }
  if (growth !== null && growth >= CRESCIMENTO_ALTO && quality !== null && quality < QUALIDADE_BAIXA) {
    return {
      erro: buscar("crescimento_sem_qualidade"),
      porque: `Growth em ${growth} mas Quality em ${quality} — crescimento forte sem qualidade equivalente por trás.`,
    };
  }
  if (quality !== null && quality >= QUALIDADE_ALTA && earningsYield !== null && earningsYield < EARNINGS_YIELD_CARO) {
    return {
      erro: buscar("comprar_caro"),
      porque: `Quality em ${quality} (alta) com Earnings Yield de ${(earningsYield * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% (preço já caro pelo critério do sistema).`,
    };
  }
  if (earningsYield !== null && earningsYield >= EARNINGS_YIELD_MUITO_BARATO && quality !== null && quality < QUALIDADE_BAIXA) {
    return {
      erro: buscar("so_pl"),
      porque: `Earnings Yield de ${(earningsYield * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% (muito barata) com Quality em ${quality} (baixa) — preço baixo pode estar refletindo o próprio problema.`,
    };
  }
  return null;
}
