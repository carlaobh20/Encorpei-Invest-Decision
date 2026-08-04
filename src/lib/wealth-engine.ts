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
