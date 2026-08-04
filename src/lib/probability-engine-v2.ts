import { calcularDrawdown, indiceAcumulado, type ObservacaoBenchmark } from "./patrimonio";
import { estimativaDeAmostra, estimativaIndisponivel, type EstimativaComIntervalo } from "./estimativa";

/**
 * PROBABILITY ENGINE V2 (Foundation v3.1 — Módulo 4).
 *
 * NÃO substitui `probability-engine.ts` (v1) — são perguntas diferentes.
 * v1: "as decisões que EU tomei no Diário deram certo?" (julga decisão do
 * investidor). v2: "historicamente, o PREÇO desta empresa superou CDI e
 * Ibovespa em janelas de 12/24/36/60 meses?" (backtest de preço, não
 * depende de nenhuma decisão ter sido registrada).
 *
 * Reaproveita, sem duplicar (Foundation v3.1 — Módulo 8):
 * - `indiceAcumulado` (patrimonio.ts) para os índices de preço/CDI/Ibovespa.
 * - `calcularDrawdown` (patrimonio.ts) para o drawdown dentro de cada janela.
 * - `estimativaDeAmostra`/`EstimativaComIntervalo` (estimativa.ts) para nunca
 *   devolver um número solto.
 * - 252 pregões/ano e 21 pregões/mês — mesma convenção já usada no Sharpe
 *   de patrimonio.ts (`Math.sqrt(252)`), não uma constante nova inventada.
 *
 * FALHA CONCEITUAL IDENTIFICADA E DOCUMENTADA (por instrução explícita do
 * Carlos no pedido do v3.1): calcular probabilidade de bater CDI/Ibovespa em
 * horizontes de até 60 meses exige, no mínimo, alguns anos de histórico de
 * preço. A coleta diária de preços deste sistema começou em 2026 — poucos
 * meses de dado. Resultado: com o histórico de hoje, os 4 horizontes vão
 * retornar `null` com motivo explícito por MUITO tempo (anos, não semanas).
 * Isso não é um bug a corrigir — é exatamente o comportamento pedido
 * ("quando não houver histórico suficiente: retornar NULL + motivo
 * detalhado. Nunca inventar números"). Não há solução de código para dado
 * que ainda não existe; só o tempo resolve.
 *
 * Corte honesto adicional: as janelas usadas para compor a distribuição são
 * MÓVEIS e SOBREPOSTAS (passo de 1 pregão) — não são observações
 * estatisticamente independentes entre si (a janela de hoje compartilha
 * quase todos os dias com a de ontem). Por isso o gate mínimo abaixo exige
 * pelo menos `MIN_JANELAS_NAO_SOBREPOSTAS` janelas que caibam SEM
 * sobreposição no histórico — só assim há genuína diversidade de períodos
 * — mesmo que a distribuição reportada, depois de destravado o gate, use
 * as janelas sobrepostas (mais denso, mas rotulado como tal).
 */

export type HorizonteMeses = 12 | 24 | 36 | 60;
export const HORIZONTES_MESES: HorizonteMeses[] = [12, 24, 36, 60];

/** Convenção já usada em patrimonio.ts (Sharpe anualizado com sqrt(252)). */
export const PREGOES_POR_MES = 21;

/** Mínimo de janelas NÃO sobrepostas que precisam caber no histórico antes de reportar qualquer número. */
export const MIN_JANELAS_NAO_SOBREPOSTAS = 2;

export type ResultadoHorizonte = {
  horizonteMeses: HorizonteMeses;
  /** quantas janelas desse tamanho cabem SEM sobreposição no histórico disponível — mede a base real, não infla com sobreposição */
  janelasNaoSobrepostasDisponiveis: number;
  /** nº de janelas móveis (sobrepostas) efetivamente usadas na distribuição abaixo — não são observações independentes */
  observacoesJanelasMoveis: number;
  probabilidadeSuperarCdi: number | null;
  probabilidadeSuperarIbovespa: number | null;
  retornoEsperado: EstimativaComIntervalo;
  drawdownEsperado: EstimativaComIntervalo;
  motivo: string | null;
};

export type ResultadoProbabilidadeV2 = {
  ticker: string;
  horizontes: Record<HorizonteMeses, ResultadoHorizonte>;
  metodo: string;
};

function horizonteIndisponivel(horizonteMeses: HorizonteMeses, janelasDisponiveis: number, motivo: string): ResultadoHorizonte {
  return {
    horizonteMeses,
    janelasNaoSobrepostasDisponiveis: janelasDisponiveis,
    observacoesJanelasMoveis: 0,
    probabilidadeSuperarCdi: null,
    probabilidadeSuperarIbovespa: null,
    retornoEsperado: estimativaIndisponivel(motivo),
    drawdownEsperado: estimativaIndisponivel(motivo),
    motivo,
  };
}

export type EntradaProbabilidadeV2 = {
  ticker: string;
  /** preço de fechamento diário da empresa — {data, valor: fechamento} */
  precos: ObservacaoBenchmark[];
  cdi: ObservacaoBenchmark[];
  ibovespa: ObservacaoBenchmark[];
};

export function calcularProbabilidadeHistoricaV2(entrada: EntradaProbabilidadeV2): ResultadoProbabilidadeV2 {
  const datas = [...new Set(entrada.precos.map((p) => p.data))].sort();
  const precoIdx = indiceAcumulado(entrada.precos, "nivel", datas);
  const cdiIdx = indiceAcumulado(entrada.cdi, "taxa_diaria", datas);
  const ibovIdx = indiceAcumulado(entrada.ibovespa, "nivel", datas);

  const horizontes = {} as Record<HorizonteMeses, ResultadoHorizonte>;

  for (const h of HORIZONTES_MESES) {
    const janela = h * PREGOES_POR_MES;
    const janelasNaoSobrepostas = Math.floor(datas.length / janela);

    if (janelasNaoSobrepostas < MIN_JANELAS_NAO_SOBREPOSTAS) {
      const pregoesNecessarios = janela * MIN_JANELAS_NAO_SOBREPOSTAS;
      horizontes[h] = horizonteIndisponivel(
        h,
        janelasNaoSobrepostas,
        `Precisa de pelo menos ${pregoesNecessarios} pregões (~${(pregoesNecessarios / 252).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} anos) de histórico para ${MIN_JANELAS_NAO_SOBREPOSTAS} janelas independentes de ${h} meses; há ${datas.length} pregões coletados hoje.`
      );
      continue;
    }

    const retornosEmpresa: number[] = [];
    const drawdowns: number[] = [];
    let superouCdi = 0;
    let comparaveisCdi = 0;
    let superouIbov = 0;
    let comparaveisIbov = 0;

    for (let i = 0; i + janela < datas.length; i++) {
      const dIni = datas[i];
      const dFim = datas[i + janela];
      const pIni = precoIdx.get(dIni);
      const pFim = precoIdx.get(dFim);
      if (pIni === null || pIni === undefined || pFim === null || pFim === undefined) continue;

      const retornoEmpresa = pFim / pIni - 1;
      retornosEmpresa.push(retornoEmpresa);

      const precosDaJanela: number[] = [];
      for (let j = i; j <= i + janela; j++) {
        const v = precoIdx.get(datas[j]);
        if (v !== null && v !== undefined) precosDaJanela.push(v);
      }
      const dd = calcularDrawdown(precosDaJanela);
      if (dd !== null) drawdowns.push(dd);

      const cIni = cdiIdx.get(dIni);
      const cFim = cdiIdx.get(dFim);
      if (cIni !== null && cIni !== undefined && cFim !== null && cFim !== undefined) {
        comparaveisCdi++;
        if (retornoEmpresa > cFim / cIni - 1) superouCdi++;
      }

      const ibIni = ibovIdx.get(dIni);
      const ibFim = ibovIdx.get(dFim);
      if (ibIni !== null && ibIni !== undefined && ibFim !== null && ibFim !== undefined) {
        comparaveisIbov++;
        if (retornoEmpresa > ibFim / ibIni - 1) superouIbov++;
      }
    }

    if (retornosEmpresa.length === 0) {
      horizontes[h] = horizonteIndisponivel(
        h,
        janelasNaoSobrepostas,
        `Há pregões suficientes no calendário, mas nenhuma janela de ${h} meses teve preço da empresa nas duas pontas — provável buraco no histórico coletado.`
      );
      continue;
    }

    horizontes[h] = {
      horizonteMeses: h,
      janelasNaoSobrepostasDisponiveis: janelasNaoSobrepostas,
      observacoesJanelasMoveis: retornosEmpresa.length,
      probabilidadeSuperarCdi: comparaveisCdi > 0 ? superouCdi / comparaveisCdi : null,
      probabilidadeSuperarIbovespa: comparaveisIbov > 0 ? superouIbov / comparaveisIbov : null,
      retornoEsperado: estimativaDeAmostra(retornosEmpresa),
      drawdownEsperado: estimativaDeAmostra(drawdowns),
      motivo: null,
    };
  }

  return {
    ticker: entrada.ticker,
    horizontes,
    metodo:
      "Probability Engine v2 (Foundation v3.1) — janelas móveis sobre o histórico de preço da própria empresa vs. CDI/Ibovespa. Exige pelo menos 2 janelas NÃO sobrepostas por horizonte para reportar qualquer número (evita contar a mesma alta/queda várias vezes como se fossem observações independentes); abaixo disso, null + motivo. Com o histórico de preço atual do sistema, a expectativa é que os 4 horizontes fiquem null por um bom tempo — comportamento correto, não bug. Nunca é garantia de retorno futuro.",
  };
}
