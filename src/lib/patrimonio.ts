/**
 * PATRIMÔNIO — motor puro do novo centro da plataforma (PIC 01, 03/08/2026).
 *
 * Responde às perguntas que o Carlos definiu como o novo objetivo do
 * Encorpei: "meu patrimônio está crescendo acima da inflação?", "estou
 * gerando Alpha?", "minha carteira está melhor ou pior que mês passado?".
 *
 * Método (registrado porque é uma escolha, não um fato):
 * - Só entram na série posições com `data_compra` conhecida — sem data não
 *   dá pra posicionar no tempo, e o sistema NUNCA estima uma data que você
 *   não informou. Posições sem data ficam de fora, listadas à parte.
 * - Assume quantidade CONSTANTE desde `data_compra` até hoje (não temos
 *   ledger de compras/vendas parciais — só a posição atual + uma data).
 *   Isso significa: se você comprou mais ou vendeu parte depois da data
 *   registrada, a série retroativa não capta esse movimento. Documentado
 *   na tela, não escondido.
 * - Comparação com CDI/IPCA/Ibovespa é por SIMULAÇÃO DE APORTE: para cada
 *   posição, "se o dinheiro investido nela (valorInvestido, na mesma data)
 *   tivesse ido para o benchmark, quanto valeria hoje?" — soma de todas as
 *   posições dá a curva do benchmark simulado, diretamente comparável em
 *   R$ com a curva real da carteira (mesmos aportes, mesmas datas).
 * - CDI e IPCA vêm do BCB/SGS como TAXA (% ao dia e % no mês); Ibovespa
 *   vem como NÍVEL (pontos). `indiceAcumulado` trata os três com o mesmo
 *   contrato, sem confundir taxa com nível.
 * - A simulação do benchmark ANCORA no primeiro pregão coberto pelo
 *   histórico de preço das ações (`datasNaJanela[0]`), não literalmente na
 *   `data_compra`, quando essa data é anterior ao início do backfill de
 *   preços. Corrigido em 03/08/2026 (Carlos reportou CDI/Ibovespa sumidos
 *   do gráfico): buscar o índice do benchmark exatamente EM `data_compra`
 *   falhava sempre que o backfill de preço começava depois — a curva real
 *   da carteira também só é comparável a partir desse mesmo primeiro
 *   pregão comum, então ancorar os dois ali é o corte honesto, não uma
 *   aproximação.
 */

export type ObservacaoBenchmark = { data: string; valor: number };
export type TipoBenchmark = "taxa_diaria" | "taxa_evento" | "nivel";

export type PosicaoDatada = {
  ticker: string;
  quantidade: number;
  precoMedio: number;
  dataCompra: string; // YYYY-MM-DD, sempre presente aqui (filtrado antes)
};

export type PontoPatrimonio = {
  data: string;
  valorCarteira: number;
  valorInvestidoAcumulado: number;
  cdiSimulado: number | null;
  ipcaSimulado: number | null;
  ibovespaSimulado: number | null;
};

export type ResultadoPatrimonio = {
  pontos: PontoPatrimonio[];
  posicoesForaDaSerie: string[]; // sem data_compra — não entraram
  drawdownMaximo: number | null; // negativo, ex.: -0.12 = -12%
  sharpe: number | null;
  /** desvio padrão anualizado dos retornos diários da carteira (não do excesso vs. CDI) */
  volatilidadeAnualizada: number | null;
  /** mesma lógica do Sharpe, mas só penaliza desvio ABAIXO do CDI (downside deviation) */
  sortino: number | null;
  /** cobre Sharpe, Sortino e Volatilidade — as três nascem do mesmo gate honesto */
  motivoSemSharpe: string | null;
  rentabilidadeTotal: number | null;
  alpha: { vsCdi: number | null; vsIpca: number | null; vsIbovespa: number | null };
};

/**
 * Índice acumulado (base 1.0 no primeiro ponto >= `desde`), amostrado nas
 * datas de `nasDatas` (datas de pregão — é nelas que precisamos comparar).
 * - taxa_diaria (CDI): valor = % ao dia → índice(t) = índice(t-1) × (1+valor/100)
 *   a cada observação encontrada até e incluindo o dia.
 * - taxa_evento (IPCA): valor = % no mês, publicado 1x/mês → índice é uma
 *   função em degraus, sobe só quando existe observação naquele dia.
 * - nivel (Ibovespa): índice(t) = pontos(t) / pontos(desde).
 * Nunca inventa observação num dia sem dado: repete o último índice
 * conhecido (comportamento padrão de qualquer benchmark "flat" em dia sem
 * publicação — CDI/IPCA não publicam fim de semana, por exemplo).
 */
export function indiceAcumulado(
  observacoes: ObservacaoBenchmark[],
  tipo: TipoBenchmark,
  nasDatas: string[]
): Map<string, number | null> {
  const porData = new Map(observacoes.map((o) => [o.data, o.valor]));
  const datasOrdenadas = [...nasDatas].sort();
  const resultado = new Map<string, number | null>();

  let indice: number | null = null;
  let nivelBase: number | null = null;

  for (const data of datasOrdenadas) {
    const valor = porData.get(data);
    if (tipo === "nivel") {
      if (valor !== undefined) {
        if (nivelBase === null) nivelBase = valor;
        indice = nivelBase > 0 ? valor / nivelBase : null;
      }
    } else if (tipo === "taxa_diaria") {
      if (valor !== undefined) {
        indice = indice === null ? 1 : indice * (1 + valor / 100);
      } else if (indice === null) {
        // ainda não achou a primeira observação: fica null até achar
      }
    } else {
      // taxa_evento (IPCA): só sobe em dia de publicação
      if (valor !== undefined) {
        indice = indice === null ? 1 : indice * (1 + valor / 100);
      } else if (indice === null) {
        // idem
      }
    }
    resultado.set(data, indice);
  }
  return resultado;
}

/**
 * Monta a série diária de patrimônio + benchmarks simulados por aporte.
 * `precosPorTicker` e os benchmarks precisam cobrir, no mínimo, da menor
 * `dataCompra` até hoje — datas fora do intervalo coberto simplesmente não
 * aparecem (nunca preenche com zero ou repete preço "no escuro" além de 1
 * dia útil, ver `ultimoFechamentoAteAData`).
 */
export function calcularSeriePatrimonio(input: {
  posicoes: PosicaoDatada[];
  precosPorTicker: Map<string, { data: string; fechamento: number }[]>;
  cdi: ObservacaoBenchmark[];
  ipca: ObservacaoBenchmark[];
  ibovespa: ObservacaoBenchmark[];
  /** todas as datas de pregão do universo, ascendente — define o eixo X */
  datasPregao: string[];
}): ResultadoPatrimonio {
  const { posicoes, precosPorTicker, datasPregao } = input;

  if (posicoes.length === 0 || datasPregao.length === 0) {
    return {
      pontos: [],
      posicoesForaDaSerie: [],
      drawdownMaximo: null,
      sharpe: null,
      volatilidadeAnualizada: null,
      sortino: null,
      motivoSemSharpe: "Sem posições datadas para montar a série.",
      rentabilidadeTotal: null,
      alpha: { vsCdi: null, vsIpca: null, vsIbovespa: null },
    };
  }

  const dataMinima = posicoes.reduce((m, p) => (p.dataCompra < m ? p.dataCompra : m), posicoes[0].dataCompra);
  const datasNaJanela = datasPregao.filter((d) => d >= dataMinima).sort();

  const idxCdi = indiceAcumulado(input.cdi, "taxa_diaria", datasNaJanela);
  const idxIpca = indiceAcumulado(input.ipca, "taxa_evento", datasNaJanela);
  const idxIbov = indiceAcumulado(input.ibovespa, "nivel", datasNaJanela);

  // último fechamento conhecido até (e incluindo) a data — nunca "no futuro"
  function ultimoFechamentoAteAData(ticker: string, data: string): number | null {
    const serie = precosPorTicker.get(ticker);
    if (!serie) return null;
    let ultimo: number | null = null;
    for (const p of serie) {
      if (p.data > data) break;
      ultimo = p.fechamento;
    }
    return ultimo;
  }

  // Data de entrada usada pra buscar o índice do benchmark. Normalmente é a
  // própria dataCompra — mas se o histórico de preço das ações (que define
  // `datasNaJanela`) começar DEPOIS da dataCompra registrada (backfill mais
  // raso que o registro do Carlos), a dataCompra nunca aparece como chave no
  // índice do benchmark (que só existe nas datas de `datasNaJanela`) e a
  // simulação inteira ficava presa em null pra sempre — mesmo com CDI/IPCA
  // cobrindo o período de sobra. Corte honesto aqui NÃO é fingir dado antes
  // do que existe: é ancorar a simulação no primeiro pregão em que a posição
  // já é comparável de verdade (mesmo dia em que valorCarteira passa a
  // contar preço real dela) — nunca antes disso pra nenhuma das duas pernas.
  const primeiraDataJanela = datasNaJanela[0];

  const pontos: PontoPatrimonio[] = [];
  for (const data of datasNaJanela) {
    let valorCarteira = 0;
    let valorInvestidoAcumulado = 0;
    let cdiSimulado = 0;
    let ipcaSimulado = 0;
    let ibovSimulado = 0;
    let temTodosBenchmarks = true;

    for (const p of posicoes) {
      if (p.dataCompra > data) continue; // ainda não tinha entrado
      const preco = ultimoFechamentoAteAData(p.ticker, data);
      if (preco !== null) valorCarteira += p.quantidade * preco;
      const valorInvestido = p.quantidade * p.precoMedio;
      valorInvestidoAcumulado += valorInvestido;

      const dataEntradaBenchmark = p.dataCompra > primeiraDataJanela ? p.dataCompra : primeiraDataJanela;

      const iCdiEntrada = idxCdi.get(dataEntradaBenchmark) ?? null;
      const iCdiHoje = idxCdi.get(data) ?? null;
      if (iCdiEntrada && iCdiHoje) cdiSimulado += valorInvestido * (iCdiHoje / iCdiEntrada);
      else temTodosBenchmarks = false;

      const iIpcaEntrada = idxIpca.get(dataEntradaBenchmark) ?? null;
      const iIpcaHoje = idxIpca.get(data) ?? null;
      if (iIpcaEntrada && iIpcaHoje) ipcaSimulado += valorInvestido * (iIpcaHoje / iIpcaEntrada);
      else temTodosBenchmarks = false;

      const iIbovEntrada = idxIbov.get(dataEntradaBenchmark) ?? null;
      const iIbovHoje = idxIbov.get(data) ?? null;
      if (iIbovEntrada && iIbovHoje) ibovSimulado += valorInvestido * (iIbovHoje / iIbovEntrada);
      else temTodosBenchmarks = false;
    }

    pontos.push({
      data,
      valorCarteira,
      valorInvestidoAcumulado,
      cdiSimulado: temTodosBenchmarks || cdiSimulado > 0 ? cdiSimulado || null : null,
      ipcaSimulado: temTodosBenchmarks || ipcaSimulado > 0 ? ipcaSimulado || null : null,
      ibovespaSimulado: temTodosBenchmarks || ibovSimulado > 0 ? ibovSimulado || null : null,
    });
  }

  const drawdownMaximo = calcularDrawdown(pontos.map((p) => p.valorCarteira));
  const ultimo = pontos[pontos.length - 1] ?? null;
  const rentabilidadeTotal =
    ultimo && ultimo.valorInvestidoAcumulado > 0
      ? ultimo.valorCarteira / ultimo.valorInvestidoAcumulado - 1
      : null;

  const rentBenchmark = (campo: "cdiSimulado" | "ipcaSimulado" | "ibovespaSimulado") =>
    ultimo && ultimo[campo] !== null && ultimo.valorInvestidoAcumulado > 0
      ? ultimo[campo]! / ultimo.valorInvestidoAcumulado - 1
      : null;

  const alpha = {
    vsCdi:
      rentabilidadeTotal !== null && rentBenchmark("cdiSimulado") !== null
        ? rentabilidadeTotal - rentBenchmark("cdiSimulado")!
        : null,
    vsIpca:
      rentabilidadeTotal !== null && rentBenchmark("ipcaSimulado") !== null
        ? rentabilidadeTotal - rentBenchmark("ipcaSimulado")!
        : null,
    vsIbovespa:
      rentabilidadeTotal !== null && rentBenchmark("ibovespaSimulado") !== null
        ? rentabilidadeTotal - rentBenchmark("ibovespaSimulado")!
        : null,
  };

  // Sharpe/Sortino/Volatilidade: só com aporte único (senão fluxo de caixa
  // distorce retorno diário ingênuo) — corte honesto em vez de número
  // enganoso, e as três métricas nascem do MESMO gate (nunca um mais frouxo
  // que o outro).
  const datasCompraUnicas = new Set(posicoes.map((p) => p.dataCompra));
  let sharpe: number | null = null;
  let volatilidadeAnualizada: number | null = null;
  let sortino: number | null = null;
  let motivoSemSharpe: string | null = null;
  let gatePassou = false;
  if (datasCompraUnicas.size > 1) {
    motivoSemSharpe =
      "Sharpe/Sortino/Volatilidade indisponíveis: há aportes em datas diferentes, e sem o fluxo de caixa completo o retorno diário ingênuo ficaria distorcido nos dias de aporte.";
  } else if (pontos.length < 20) {
    motivoSemSharpe = "Sharpe/Sortino/Volatilidade indisponíveis: menos de 20 pregões na série ainda.";
  } else {
    const retornos: number[] = [];
    for (let i = 1; i < pontos.length; i++) {
      const a = pontos[i - 1].valorCarteira;
      const b = pontos[i].valorCarteira;
      if (a > 0) retornos.push(b / a - 1);
    }
    const cdiRetornos: number[] = [];
    for (let i = 1; i < datasNaJanela.length; i++) {
      const a = idxCdi.get(datasNaJanela[i - 1]);
      const b = idxCdi.get(datasNaJanela[i]);
      if (a && b) cdiRetornos.push(b / a - 1);
    }
    if (retornos.length >= 20 && cdiRetornos.length === retornos.length) {
      gatePassou = true;
      const excesso = retornos.map((r, i) => r - cdiRetornos[i]);
      const media = excesso.reduce((a, b) => a + b, 0) / excesso.length;
      const variancia = excesso.reduce((a, b) => a + (b - media) ** 2, 0) / excesso.length;
      const desvio = Math.sqrt(variancia);
      sharpe = desvio > 0 ? (media / desvio) * Math.sqrt(252) : null;

      // Sortino: mesmo excesso sobre o CDI, mas a "penalidade" no denominador
      // só conta os dias em que a carteira ficou ABAIXO do CDI (downside
      // deviation) — dias em que ela supera o CDI não entram como "risco".
      const downsideVariancia =
        excesso.reduce((a, b) => a + (b < 0 ? b ** 2 : 0), 0) / excesso.length;
      const downsideDesvio = Math.sqrt(downsideVariancia);
      sortino = downsideDesvio > 0 ? (media / downsideDesvio) * Math.sqrt(252) : null;

      // Volatilidade: desvio padrão anualizado dos retornos DIÁRIOS da
      // própria carteira (não do excesso vs. CDI) — leitura padrão de mercado.
      const mediaRetornos = retornos.reduce((a, b) => a + b, 0) / retornos.length;
      const varianciaRetornos =
        retornos.reduce((a, b) => a + (b - mediaRetornos) ** 2, 0) / retornos.length;
      volatilidadeAnualizada = Math.sqrt(varianciaRetornos) * Math.sqrt(252);
    } else {
      motivoSemSharpe = "Sharpe/Sortino/Volatilidade indisponíveis: série de CDI não cobre todos os pregões da carteira.";
    }
  }

  return {
    pontos,
    posicoesForaDaSerie: [],
    drawdownMaximo,
    sharpe,
    volatilidadeAnualizada,
    sortino,
    motivoSemSharpe: gatePassou ? null : motivoSemSharpe,
    rentabilidadeTotal,
    alpha,
  };
}

/** Maior queda (pico → vale) da série, em %. Retorna 0 se nunca caiu. */
export function calcularDrawdown(valores: number[]): number | null {
  if (valores.length === 0) return null;
  let pico = valores[0];
  let piorQueda = 0;
  for (const v of valores) {
    if (v > pico) pico = v;
    if (pico > 0) {
      const queda = v / pico - 1;
      if (queda < piorQueda) piorQueda = queda;
    }
  }
  return piorQueda;
}
