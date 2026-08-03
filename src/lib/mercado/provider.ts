/**
 * MARKET DATA PROVIDER — interface de preparação para o futuro.
 *
 * Pedido explícito do Carlos: "Nunca criar dependência direta de uma única
 * plataforma." Hoje todo o sistema fala diretamente com a brapi (ver
 * src/app/api/coleta/precos/route.ts). Esta interface define o contrato
 * que uma fonte de dados de mercado precisa cumprir para alimentar o
 * Technical Engine e o resto do sistema — mas ela NÃO está conectada em
 * lugar nenhum ainda.
 *
 * Por quê parar aqui: o route.ts de coleta é produção, rodando em cron
 * automático todo dia útil. Reescrevê-lo para passar por esta interface
 * no meio desta sessão seria arriscar o pipeline em produção sem
 * necessidade — ele já funciona e não precisa mudar hoje. Esta interface
 * fica pronta e testável isoladamente; a troca de verdade (route.ts
 * passando a usar um Provider) é um passo separado, deliberadamente NÃO
 * feito agora.
 *
 * Quando existir uma segunda fonte real (API profissional, por exemplo),
 * o trabalho vira: implementar `MarketDataProvider` para ela e trocar uma
 * linha no route.ts — sem tocar no resto do sistema.
 */

export type CandleDiario = {
  data: string; // YYYY-MM-DD
  abertura: number | null;
  maxima: number | null;
  minima: number | null;
  fechamento: number;
  volume: number | null;
};

export type CotacaoAtual = {
  ticker: string;
  preco: number;
  abertura: number | null;
  maxima: number | null;
  minima: number | null;
  volume: number | null;
  marketCap: number | null;
  coletadoEm: string; // ISO timestamp
};

export interface MarketDataProvider {
  /** Nome da fonte, para gravar em `fonte`/proveniência (regra CLAUDE.md §5). */
  readonly nome: string;

  /** Cotação do dia para um ticker. */
  buscarCotacaoAtual(ticker: string): Promise<CotacaoAtual | null>;

  /** Histórico diário de candles (OHLCV) para um ticker, mais antigo primeiro. */
  buscarHistorico(ticker: string, dias: number): Promise<CandleDiario[]>;
}

/**
 * Implementação sobre a brapi — mesma fonte já usada em produção. Não é
 * chamada por nenhum código de coleta ainda (ver nota acima); existe para
 * já ter uma implementação de referência do contrato, e para os testes do
 * Technical Engine poderem validar contra um shape real.
 */
export class BrapiProvider implements MarketDataProvider {
  readonly nome = "brapi";

  constructor(private readonly token: string) {}

  async buscarCotacaoAtual(ticker: string): Promise<CotacaoAtual | null> {
    const resp = await fetch(`https://brapi.dev/api/quote/${ticker}?token=${this.token}`);
    if (!resp.ok) return null;
    const json = await resp.json();
    const q = json?.results?.[0];
    if (!q) return null;
    return {
      ticker,
      preco: q.regularMarketPrice,
      abertura: q.regularMarketOpen ?? null,
      maxima: q.regularMarketDayHigh ?? null,
      minima: q.regularMarketDayLow ?? null,
      volume: q.regularMarketVolume ?? null,
      marketCap: q.marketCap ?? null,
      coletadoEm: new Date().toISOString(),
    };
  }

  async buscarHistorico(ticker: string, dias: number): Promise<CandleDiario[]> {
    const range = dias <= 30 ? "1mo" : dias <= 90 ? "3mo" : dias <= 180 ? "6mo" : "1y";
    const resp = await fetch(
      `https://brapi.dev/api/quote/${ticker}?range=${range}&interval=1d&token=${this.token}`
    );
    if (!resp.ok) return [];
    const json = await resp.json();
    const historico = json?.results?.[0]?.historicalDataPrice ?? [];
    return historico.map((h: { date: number; open?: number; high?: number; low?: number; close: number; volume?: number }) => ({
      data: new Date(h.date * 1000).toISOString().slice(0, 10),
      abertura: h.open ?? null,
      maxima: h.high ?? null,
      minima: h.low ?? null,
      fechamento: h.close,
      volume: h.volume ?? null,
    }));
  }
}
