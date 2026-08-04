import { estimativaDeAmostra, estimativaIndisponivel, type EstimativaComIntervalo } from "./estimativa";
import type { NivelConfianca } from "./proveniencia";

/**
 * FORECAST ENGINE (Foundation v4 — Módulo 9).
 *
 * A especificação pede: projeções com fonte/premissas/confiabilidade/
 * intervalo/versão; "nunca estimativas de analista diretamente"; "nunca
 * misturadas com dado histórico". Este motor implementa UM método real —
 * extrapolação trailing (taxa média de variação nos últimos N períodos,
 * projetada 1 período à frente) — reaproveitando `EstimativaComIntervalo`
 * e `estimativaDeAmostra` (estimativa.ts, Foundation v3.1) em vez de
 * inventar um segundo formato de intervalo.
 *
 * "Nunca estimativas de analista diretamente": `FonteProjecao` só tem UM
 * valor implementado (`extrapolacao_trailing`). Um valor `consenso_mercado`
 * fica nomeado no tipo para o dia em que o Research Lab validar um motor
 * assim, mas NENHUMA função aqui o produz — é documentação de intenção, não
 * capacidade.
 *
 * "Nunca misturada com dado histórico": `ProjecaoIndicador` é um tipo
 * separado de qualquer ponto de série histórica (`PontoSerieIndicador` não
 * tem os campos de proveniência da projeção, e vice-versa) — quem consome
 * não pode acidentalmente tratar um valor projetado como um valor
 * observado, porque são tipos diferentes.
 *
 * Corte honesto: só projeta 1 período à frente. Compor a taxa de variação
 * estimada por múltiplos períodos adiante amplificaria a incerteza sem
 * nenhum dado novo — decisão explícita de não fazer isso nesta versão.
 */

export type PontoSerieIndicador = { periodo: string; valor: number };

/** Só `extrapolacao_trailing` é produzido hoje — `consenso_mercado` documenta um método futuro (Research Lab), nunca implementado aqui. */
export type FonteProjecao = "extrapolacao_trailing" | "consenso_mercado";

export type ProjecaoIndicador = {
  indicador: string;
  fonte: FonteProjecao;
  /** taxa de variação estimada (não o valor absoluto projetado) — ver `valorProjetado` para o valor */
  estimativaVariacao: EstimativaComIntervalo;
  valorProjetado: number | null;
  confiabilidade: NivelConfianca | null;
  premissas: string[];
  avisos: string[];
  versao: number;
};

export const FORECAST_ENGINE_VERSAO = 1;
export const JANELA_TRAILING_PADRAO = 4;

export type OpcoesForecast = { janelaTrailing?: number };

function confiabilidadePorAmostra(n: number): NivelConfianca | null {
  if (n === 0) return null;
  if (n < 3) return "baixa";
  if (n < JANELA_TRAILING_PADRAO) return "media";
  return "alta";
}

/**
 * Projeta um indicador (receita, lucro, etc.) 1 período à frente por
 * extrapolação trailing: taxa média de variação período-a-período na
 * janela mais recente, aplicada ao último valor observado. Função pura —
 * `serie` já vem pronta, nenhuma busca acontece aqui.
 */
export function projetarIndicador(indicador: string, serie: PontoSerieIndicador[], opcoes: OpcoesForecast = {}): ProjecaoIndicador {
  const janelaTrailing = opcoes.janelaTrailing ?? JANELA_TRAILING_PADRAO;
  const avisos: string[] = [];
  const premissas = [
    `Método: extrapolação trailing — taxa média de variação período-a-período nos últimos ${janelaTrailing} períodos, projetada 1 período à frente.`,
    "Nunca é uma estimativa de analista ou de consenso de mercado — só extrapola o próprio histórico do indicador.",
    "Projeta exatamente 1 período à frente; não compõe a taxa estimada por múltiplos períodos.",
  ];

  if (serie.length < janelaTrailing + 1) {
    return {
      indicador,
      fonte: "extrapolacao_trailing",
      estimativaVariacao: estimativaIndisponivel(
        `Série com ${serie.length} período(s) — mínimo de ${janelaTrailing + 1} necessário para medir ${janelaTrailing} variações.`
      ),
      valorProjetado: null,
      confiabilidade: null,
      premissas,
      avisos,
      versao: FORECAST_ENGINE_VERSAO,
    };
  }

  const janela = serie.slice(-1 * (janelaTrailing + 1));
  const variacoes: number[] = [];
  for (let i = 1; i < janela.length; i++) {
    const anterior = janela[i - 1].valor;
    const atual = janela[i].valor;
    if (anterior === 0) {
      avisos.push(`Variação ${janela[i - 1].periodo}→${janela[i].periodo} descartada — valor anterior é zero (divisão indefinida).`);
      continue;
    }
    if (anterior < 0) {
      avisos.push(`Variação ${janela[i - 1].periodo}→${janela[i].periodo} descartada — valor anterior negativo, % de variação não é interpretável aqui.`);
      continue;
    }
    variacoes.push(atual / anterior - 1);
  }

  if (variacoes.length === 0) {
    return {
      indicador,
      fonte: "extrapolacao_trailing",
      estimativaVariacao: estimativaIndisponivel("Nenhuma variação válida na janela — todos os valores anteriores eram zero ou negativos."),
      valorProjetado: null,
      confiabilidade: null,
      premissas,
      avisos,
      versao: FORECAST_ENGINE_VERSAO,
    };
  }

  const estimativaVariacao = estimativaDeAmostra(variacoes);
  const ultimoValor = serie[serie.length - 1].valor;
  const valorProjetado = estimativaVariacao.valor !== null ? ultimoValor * (1 + estimativaVariacao.valor) : null;

  return {
    indicador,
    fonte: "extrapolacao_trailing",
    estimativaVariacao,
    valorProjetado,
    confiabilidade: confiabilidadePorAmostra(variacoes.length),
    premissas,
    avisos,
    versao: FORECAST_ENGINE_VERSAO,
  };
}
