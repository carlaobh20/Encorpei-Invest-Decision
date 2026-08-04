import type { ResultadoPatrimonio } from "./patrimonio";

/**
 * WEALTH ENGINE (Foundation v4 — Módulo 8).
 *
 * A especificação pede: "CAGR esperado, retorno real acima da inflação,
 * probabilidade de atingir patrimônio objetivo, tempo estimado — infra
 * only, never invent projections". Este motor NÃO recalcula patrimônio:
 * reaproveita `rentabilidadeTotal`, `alpha.vsIpca` e a série `pontos` já
 * produzidos por `calcularSeriePatrimonio` (patrimonio.ts) e só anualiza /
 * projeta a partir deles.
 *
 * "Infra only, never invent projections" foi lido, aqui, como: a
 * infraestrutura de anualização (CAGR) e de tempo-até-a-meta fica pronta e
 * funcional, mas o motor NUNCA gera uma probabilidade estatística de
 * atingir a meta — isso exigiria um motor de simulação estocástica (Monte
 * Carlo sobre distribuição de retornos) que não existe hoje. Inventar um
 * número de probabilidade sem esse motor por trás seria exatamente o tipo
 * de projeção fabricada que a especificação pede pra NUNCA fazer — por
 * isso `probabilidadeAtingirObjetivo` fica sempre `null`, com o motivo
 * explícito, até que o Research Lab valide um motor estocástico de verdade.
 * O tempo estimado é uma projeção determinística simples (juros compostos
 * ao CAGR histórico), rotulada como premissa, nunca como certeza.
 */

export type EntradaWealthEngine = {
  patrimonio: ResultadoPatrimonio;
  /** patrimônio objetivo informado por quem chama — o motor NUNCA infere uma meta */
  patrimonioObjetivo: number | null;
};

export type ResultadoWealthEngine = {
  /** CAGR histórico da carteira, anualizado a partir de `rentabilidadeTotal` e do prazo real da série */
  cagr: number | null;
  /** retorno acumulado acima do IPCA no período da série (espelha `patrimonio.alpha.vsIpca`, não recalcula) */
  retornoRealAcimaInflacao: number | null;
  /** versão anualizada do retorno acima do IPCA, mesmo prazo do CAGR */
  cagrRealAcimaInflacao: number | null;
  /** SEMPRE null nesta versão — ver doc do módulo; não existe motor estocástico por trás */
  probabilidadeAtingirObjetivo: number | null;
  /** anos estimados até `patrimonioObjetivo`, projeção determinística sob a premissa "CAGR histórico se mantém" */
  tempoEstimadoAnos: number | null;
  premissas: string[];
  avisos: string[];
  motivoSemCagr: string | null;
  motivoSemProbabilidade: string;
};

/** mínimo de pregões na série pra anualizar sem virar ruído (mesmo espírito do gate de Sharpe em patrimonio.ts) */
export const MIN_PREGOES_CAGR = 60;

function anosNaSerie(pontos: ResultadoPatrimonio["pontos"]): number | null {
  if (pontos.length < MIN_PREGOES_CAGR) return null;
  const primeira = new Date(pontos[0].data).getTime();
  const ultima = new Date(pontos[pontos.length - 1].data).getTime();
  const dias = (ultima - primeira) / (1000 * 60 * 60 * 24);
  return dias > 0 ? dias / 365.25 : null;
}

function anualizar(retornoAcumulado: number, anos: number): number {
  return Math.pow(1 + retornoAcumulado, 1 / anos) - 1;
}

const MOTIVO_SEM_PROBABILIDADE =
  "Sem motor de simulação estocástica (Monte Carlo sobre distribuição de retornos) construído ainda — apresentar uma probabilidade sem esse motor por trás seria uma projeção fabricada. Pendência para o Research Lab avaliar antes de qualquer versão futura deste campo.";

export function calcularWealthEngine(entrada: EntradaWealthEngine): ResultadoWealthEngine {
  const { patrimonio, patrimonioObjetivo } = entrada;
  const avisos: string[] = [];
  const premissas = [
    "CAGR calculado anualizando `rentabilidadeTotal` (patrimonio.ts) pelo prazo real coberto pela série — nunca um número de mercado externo.",
    `Anualização só ocorre com pelo menos ${MIN_PREGOES_CAGR} pregões na série — abaixo disso, ruído demais pra anualizar com confiança.`,
    "Tempo estimado até o objetivo assume que o CAGR histórico se mantém constante — premissa explícita, não previsão.",
  ];

  const anos = anosNaSerie(patrimonio.pontos);
  let motivoSemCagr: string | null = null;
  let cagr: number | null = null;
  let cagrRealAcimaInflacao: number | null = null;

  if (anos === null) {
    motivoSemCagr = `Menos de ${MIN_PREGOES_CAGR} pregões na série de patrimônio — CAGR indisponível ainda.`;
  } else if (patrimonio.rentabilidadeTotal === null) {
    motivoSemCagr = "Rentabilidade total da carteira indisponível (ver patrimonio.ts) — CAGR não pode ser derivado.";
  } else {
    cagr = anualizar(patrimonio.rentabilidadeTotal, anos);
    if (patrimonio.alpha.vsIpca !== null) {
      cagrRealAcimaInflacao = anualizar(patrimonio.alpha.vsIpca, anos);
    } else {
      avisos.push("Retorno real acima da inflação indisponível — alpha.vsIpca ainda não calculável em patrimonio.ts (ver motivo lá).");
    }
  }

  let tempoEstimadoAnos: number | null = null;
  if (patrimonioObjetivo === null) {
    avisos.push("Sem patrimônio objetivo informado — tempo estimado não calculado.");
  } else if (cagr === null) {
    avisos.push("Sem CAGR histórico calculável — tempo estimado não projetado (evita projetar sobre premissa inexistente).");
  } else {
    const ultimo = patrimonio.pontos[patrimonio.pontos.length - 1] ?? null;
    const patrimonioAtual = ultimo?.valorCarteira ?? null;
    if (patrimonioAtual === null || patrimonioAtual <= 0) {
      avisos.push("Patrimônio atual indisponível ou não positivo — tempo estimado não projetado.");
    } else if (patrimonioObjetivo <= patrimonioAtual) {
      tempoEstimadoAnos = 0;
      avisos.push("Patrimônio objetivo já foi atingido pelo valor atual da carteira.");
    } else if (cagr <= 0) {
      avisos.push("CAGR histórico não positivo — projeção de juros compostos não converge para a meta; tempo estimado não calculado.");
    } else {
      tempoEstimadoAnos = Math.log(patrimonioObjetivo / patrimonioAtual) / Math.log(1 + cagr);
    }
  }

  return {
    cagr,
    retornoRealAcimaInflacao: patrimonio.alpha.vsIpca,
    cagrRealAcimaInflacao,
    probabilidadeAtingirObjetivo: null,
    tempoEstimadoAnos,
    premissas,
    avisos,
    motivoSemCagr,
    motivoSemProbabilidade: MOTIVO_SEM_PROBABILIDADE,
  };
}

/**
 * SIMULADOR DE META (Bloco 2, Sprint 2.9, Wealth Intelligence Layer —
 * Módulo 1, extensão do Wealth Engine). "Cadastrar meta/prazo/aporte
 * mensal/inflação esperada, permitir simulações/probabilidade/gap. Nunca
 * criar estimativas sem identificar claramente quando forem projeções."
 *
 * Esta função é EFÊMERA por decisão de escopo: não lê nem grava nada no
 * banco (ver `docs/wealth-intelligence-layer.md` — cadastro PERSISTENTE de
 * meta exigiria uma tabela nova, e já existem 2 migrações escritas e
 * paradas há 5 sprints pelo bloqueio de conector Supabase; empilhar uma
 * terceira sem forma de testar contra o banco real repetiria a mesma
 * decisão de escopo já registrada no Sprint 2.8). Carlos digita a meta
 * toda vez que quiser simular — sem persistência entre sessões.
 *
 * "Probabilidade" continua NUNCA fabricada — mesma disciplina de
 * `calcularWealthEngine` acima: exigiria motor estocástico (Monte Carlo)
 * que não existe, e construir um agora violaria a própria regra desta
 * sprint ("não criar novos motores"). Em vez disso, entrega uma PROJEÇÃO
 * DETERMINÍSTICA (juros compostos reais + aportes mensais, mesma família
 * de cálculo que `tempoEstimadoAnos` já usa acima) — sempre rotulada como
 * premissa, nunca como garantia ou estatística.
 *
 * Tudo em TERMOS REAIS (acima do IPCA) — mesma convenção do Carry e do
 * resto do sistema. `inflacaoEspAA`, quando informada, só converte o
 * resultado pra um valor nominal aproximado de referência — não entra na
 * conta real.
 */

export type EntradaSimulacaoMeta = {
  patrimonioAtual: number;
  metaPatrimonial: number;
  prazoAnos: number;
  aporteMensalReal: number;
  /** CAGR real (acima do IPCA) assumido na projeção — normalmente `cagrRealAcimaInflacao` já calculado acima; o usuário pode sobrescrever pra testar cenários */
  cagrRealAA: number | null;
  inflacaoEspAA: number | null;
};

export type ResultadoSimulacaoMeta = {
  /** projeção determinística do patrimônio ao final do prazo, nos aportes e CAGR informados — nunca uma garantia */
  patrimonioProjetado: number | null;
  /** metaPatrimonial - patrimonioProjetado; positivo = projeção fica AQUÉM da meta */
  gap: number | null;
  /** CAGR real anual que fecharia o gap exatamente no prazo informado, mantendo o mesmo aporte mensal — null se não convergir */
  cagrNecessarioAA: number | null;
  /** meta convertida a valores nominais estimados ao final do prazo, só como referência — nunca usada na conta real */
  metaNominalEstimada: number | null;
  motivoIndisponivel: string | null;
  premissas: string[];
  avisoProjecao: string;
};

const AVISO_PROJECAO_META =
  "Projeção determinística — juros compostos reais sobre o CAGR informado, nunca uma probabilidade estatística. Não é garantia de resultado; o mercado pode entregar CAGR bem diferente do histórico.";

function valorFuturoComAportes(patrimonioAtual: number, aporteMensal: number, cagrAA: number, anos: number): number {
  const meses = Math.round(anos * 12);
  const taxaMensal = Math.pow(1 + cagrAA, 1 / 12) - 1;
  const fvPrincipal = patrimonioAtual * Math.pow(1 + cagrAA, anos);
  const fvAportes =
    Math.abs(taxaMensal) < 1e-12
      ? aporteMensal * meses
      : aporteMensal * ((Math.pow(1 + taxaMensal, meses) - 1) / taxaMensal);
  return fvPrincipal + fvAportes;
}

/** Bisseção simples — FV é monotonicamente crescente em cagrAA, então converge sem precisar de derivada. */
function cagrNecessarioParaMeta(
  patrimonioAtual: number,
  aporteMensal: number,
  anos: number,
  meta: number
): number | null {
  let baixo = -0.5;
  let alto = 1.0;
  if (valorFuturoComAportes(patrimonioAtual, aporteMensal, alto, anos) < meta) return null; // meta inatingível mesmo a 100% a.a. real
  for (let i = 0; i < 60; i++) {
    const meio = (baixo + alto) / 2;
    const fv = valorFuturoComAportes(patrimonioAtual, aporteMensal, meio, anos);
    if (fv < meta) baixo = meio;
    else alto = meio;
  }
  return (baixo + alto) / 2;
}

export function simularMeta(entrada: EntradaSimulacaoMeta): ResultadoSimulacaoMeta {
  const { patrimonioAtual, metaPatrimonial, prazoAnos, aporteMensalReal, cagrRealAA, inflacaoEspAA } = entrada;

  const premissas = [
    "Tudo em termos reais (acima do IPCA) — mesma convenção do Carry.",
    "Projeção assume CAGR real e aporte mensal constantes pelo prazo inteiro — premissa explícita, não previsão.",
    "Sem motor estocástico: não há probabilidade estatística, só a projeção sob esta premissa única.",
  ];

  if (prazoAnos <= 0) {
    return {
      patrimonioProjetado: null,
      gap: null,
      cagrNecessarioAA: null,
      metaNominalEstimada: null,
      motivoIndisponivel: "Prazo precisa ser maior que zero.",
      premissas,
      avisoProjecao: AVISO_PROJECAO_META,
    };
  }
  if (cagrRealAA === null) {
    return {
      patrimonioProjetado: null,
      gap: null,
      cagrNecessarioAA: null,
      metaNominalEstimada: null,
      motivoIndisponivel: "Sem CAGR real histórico calculável ainda (carteira recente demais) — informe um CAGR manualmente pra simular.",
      premissas,
      avisoProjecao: AVISO_PROJECAO_META,
    };
  }

  const patrimonioProjetado = valorFuturoComAportes(patrimonioAtual, aporteMensalReal, cagrRealAA, prazoAnos);
  const gap = metaPatrimonial - patrimonioProjetado;
  const cagrNecessarioAA = cagrNecessarioParaMeta(patrimonioAtual, aporteMensalReal, prazoAnos, metaPatrimonial);
  const metaNominalEstimada = inflacaoEspAA !== null ? metaPatrimonial * Math.pow(1 + inflacaoEspAA, prazoAnos) : null;

  return {
    patrimonioProjetado,
    gap,
    cagrNecessarioAA,
    metaNominalEstimada,
    motivoIndisponivel: null,
    premissas,
    avisoProjecao: AVISO_PROJECAO_META,
  };
}
