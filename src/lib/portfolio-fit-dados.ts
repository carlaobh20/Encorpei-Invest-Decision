import type { SupabaseClient } from "@supabase/supabase-js";
import { calcularPortfolioFit, type CandidataPortfolioFit, type PosicaoExistente, type ResultadoPortfolioFit } from "@/lib/portfolio-fit";
import type { ObservacaoBenchmark } from "@/lib/patrimonio";
import type { Decision } from "@/lib/decision-object";
import type { LinhaCompounder } from "@/lib/compounder-dados";
import { modeloDe } from "@/lib/setores";

/**
 * PORTFOLIO FIT DADOS (Bloco 2 — Sprint 2.1, Meu Dash).
 *
 * O Portfolio Fit Engine (Foundation v4, Módulo 5) foi desenhado para
 * avaliar uma CANDIDATA contra a carteira (`calcularPortfolioFit(candidata,
 * posicoes)`). Meu Dash pede Portfolio Fit por posição JÁ existente — este
 * arquivo é o adaptador: para cada posição, ela mesma vira a "candidata" e
 * as outras posições (excluindo ela própria) viram `posicoes`. Nenhuma
 * conta nova, só a composição que faltava.
 */

type PrecoRow = { ticker: string; data: string; fechamento: number; volume: number | null };

/** Paginado — mesma razão de technical-dados.ts (PostgREST corta em ~1000 linhas por página). */
async function buscarPrecosLongos(sb: SupabaseClient, tickers: string[]): Promise<PrecoRow[]> {
  if (tickers.length === 0) return [];
  const PAGINA = 1000;
  const linhas: PrecoRow[] = [];
  for (let inicio = 0; ; inicio += PAGINA) {
    const { data, error } = await sb
      .from("precos_diarios")
      .select("ticker, data, fechamento, volume")
      .in("ticker", tickers)
      .order("data", { ascending: true })
      .range(inicio, inicio + PAGINA - 1);
    if (error || !data || data.length === 0) break;
    linhas.push(...(data as PrecoRow[]));
    if (data.length < PAGINA) break;
  }
  return linhas;
}

export type EntradaPortfolioFitCarteira = {
  ticker: string;
  peso: number; // 0-1, sobre o valor atual
};

/**
 * Monta Portfolio Fit por posição já existente — cada posição avaliada
 * contra o RESTO da carteira (nunca contra si mesma). Função assíncrona
 * (busca preços), delega todo cálculo ao Foundation v4 (portfolio-fit.ts).
 */
export type ResultadoPortfolioFitCarteira = {
  porTicker: Map<string, ResultadoPortfolioFit>;
  volumeMedioReaisPorTicker: Map<string, number | null>;
};

export async function montarPortfolioFitCarteira(
  sb: SupabaseClient,
  posicoes: EntradaPortfolioFitCarteira[],
  decisions: Map<string, Decision>,
  compounderPorTicker: Map<string, LinhaCompounder>,
  setorPorTicker: Map<string, string | null>
): Promise<ResultadoPortfolioFitCarteira> {
  const tickers = posicoes.map((p) => p.ticker);
  const precosRaw = await buscarPrecosLongos(sb, tickers);

  const precosPorTicker = new Map<string, ObservacaoBenchmark[]>();
  const volumeMedioPorTicker = new Map<string, number | null>();
  for (const t of tickers) {
    const ps = precosRaw.filter((p) => p.ticker === t);
    precosPorTicker.set(
      t,
      ps.map((p) => ({ data: p.data, valor: Number(p.fechamento) }))
    );
    const comVolume = ps.filter((p) => p.volume !== null).slice(-30); // últimos ~30 pregões
    volumeMedioPorTicker.set(
      t,
      comVolume.length > 0
        ? comVolume.reduce((a, p) => a + Number(p.volume) * Number(p.fechamento), 0) / comVolume.length
        : null
    );
  }

  const porTicker = new Map<string, ResultadoPortfolioFit>();

  for (const posicao of posicoes) {
    const outras: PosicaoExistente[] = posicoes
      .filter((p) => p.ticker !== posicao.ticker)
      .map((p) => ({
        ticker: p.ticker,
        setor: setorPorTicker.get(p.ticker) ?? null,
        pesoNaCarteira: p.peso,
        precos: precosPorTicker.get(p.ticker),
      }));

    const decision = decisions.get(posicao.ticker);
    const comp = compounderPorTicker.get(posicao.ticker);

    const candidata: CandidataPortfolioFit = {
      ticker: posicao.ticker,
      setor: setorPorTicker.get(posicao.ticker) ?? null,
      modelo: modeloDe(posicao.ticker),
      pesoProposto: posicao.peso,
      carryReal: decision?.carry ?? null,
      growthScore: decision?.growth ?? null,
      alavancagem: comp?.alavancagem ?? null,
      retencao: comp?.retencao ?? null,
      precos: precosPorTicker.get(posicao.ticker),
      volumeMedioReais: volumeMedioPorTicker.get(posicao.ticker) ?? null,
    };

    porTicker.set(posicao.ticker, calcularPortfolioFit(candidata, outras));
  }

  return { porTicker, volumeMedioReaisPorTicker: volumeMedioPorTicker };
}

/**
 * PORTFOLIO FIT — CANDIDATAS (Bloco 2 — Sprint 2.1, Decision Center).
 *
 * `calcularPortfolioFit(candidata, posicoes)` foi desenhado ORIGINALMENTE
 * para este caso: candidata ainda NÃO detida vs. carteira real. Diferente de
 * `montarPortfolioFitCarteira` acima (que é o adaptador candidata-vs-si-mesma
 * para posições JÁ detidas), aqui é o uso direto e original da função —
 * nenhuma conta nova.
 *
 * `pesoPropostoHipotetico` (padrão 5%) é um peso HIPOTÉTICO só para o Fit
 * Engine simular "se eu entrasse com X% do patrimônio" — nunca uma
 * recomendação de tamanho de posição (CLAUDE.md regra 7, "linguagem
 * neutra"). A UI que consumir isto precisa deixar esse rótulo explícito.
 */
export async function montarPortfolioFitOportunidades(
  sb: SupabaseClient,
  candidatas: { ticker: string; setor: string | null }[],
  posicoesAtuais: EntradaPortfolioFitCarteira[],
  decisions: Map<string, Decision>,
  compounderPorTicker: Map<string, LinhaCompounder>,
  setorPorTicker: Map<string, string | null>,
  pesoPropostoHipotetico = 0.05
): Promise<Map<string, ResultadoPortfolioFit>> {
  const tickersCandidatas = candidatas.map((c) => c.ticker);
  const tickersAtuais = posicoesAtuais.map((p) => p.ticker);
  const todosTickers = [...new Set([...tickersCandidatas, ...tickersAtuais])];
  const precosRaw = await buscarPrecosLongos(sb, todosTickers);

  const precosPorTicker = new Map<string, ObservacaoBenchmark[]>();
  const volumeMedioPorTicker = new Map<string, number | null>();
  for (const t of todosTickers) {
    const ps = precosRaw.filter((p) => p.ticker === t);
    precosPorTicker.set(
      t,
      ps.map((p) => ({ data: p.data, valor: Number(p.fechamento) }))
    );
    const comVolume = ps.filter((p) => p.volume !== null).slice(-30);
    volumeMedioPorTicker.set(
      t,
      comVolume.length > 0
        ? comVolume.reduce((a, p) => a + Number(p.volume) * Number(p.fechamento), 0) / comVolume.length
        : null
    );
  }

  const posicoesExistentes: PosicaoExistente[] = posicoesAtuais.map((p) => ({
    ticker: p.ticker,
    setor: setorPorTicker.get(p.ticker) ?? null,
    pesoNaCarteira: p.peso,
    precos: precosPorTicker.get(p.ticker),
  }));

  const porTicker = new Map<string, ResultadoPortfolioFit>();
  for (const c of candidatas) {
    const decision = decisions.get(c.ticker);
    const comp = compounderPorTicker.get(c.ticker);

    const candidata: CandidataPortfolioFit = {
      ticker: c.ticker,
      setor: c.setor,
      modelo: modeloDe(c.ticker),
      pesoProposto: pesoPropostoHipotetico,
      carryReal: decision?.carry ?? null,
      growthScore: decision?.growth ?? null,
      alavancagem: comp?.alavancagem ?? null,
      retencao: comp?.retencao ?? null,
      precos: precosPorTicker.get(c.ticker),
      volumeMedioReais: volumeMedioPorTicker.get(c.ticker) ?? null,
    };

    porTicker.set(c.ticker, calcularPortfolioFit(candidata, posicoesExistentes));
  }

  return porTicker;
}
