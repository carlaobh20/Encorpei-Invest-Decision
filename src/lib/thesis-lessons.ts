import type { ComparacaoSetorial } from "./dash-narrativa";
import type { InvestmentStory } from "./investment-story-narrativa";

/**
 * THESIS LESSONS (Bloco 2, Sprint 2.7, Investment Coach Layer — tela
 * Empresas: "O que aprendemos com esta empresa?").
 *
 * A spec pede 3 respostas: o que fez a empresa virar Compounder, quais
 * erros poderiam destruir a tese, o que diferencia dos concorrentes.
 * Nenhuma pergunta exige cálculo novo:
 *  - As 2 primeiras reaproveitam `InvestmentStory.oQueFortalece`/
 *    `oQueEnfraquece`/`principalRisco` (Explanation Engine, Sprint 2.2),
 *    sem reprocessar nada.
 *  - "O que diferencia dos concorrentes" usa o comparador setorial
 *    transversal que já existe (`dash-narrativa.ts`, `mediaSetor`/
 *    `compararComSetor`, Sprint 2.1) aplicado a ROIC e Carry — os únicos 2
 *    campos com média de setor já calculada em produção hoje. Sem
 *    comparador (setor não classificado, ou só a própria empresa no
 *    setor), a resposta é honesta: "—" com o motivo, nunca inventada.
 */

export type ThesisLessons = {
  caracteristicasCompounder: string[];
  errosQuePodemDestruir: string[];
  diferencialConcorrentes: string;
};

export type EntradaThesisLessons = {
  story: InvestmentStory;
  roicComparacaoSetor: ComparacaoSetorial;
  carryComparacaoSetor: ComparacaoSetorial;
};

function fraseDiferencial(rotulo: string, comparacao: ComparacaoSetorial): string | null {
  if (comparacao === "acima") return `${rotulo} acima da média do setor hoje`;
  if (comparacao === "abaixo") return `${rotulo} abaixo da média do setor hoje`;
  if (comparacao === "na_media") return `${rotulo} na média do setor hoje`;
  return null;
}

export function gerarThesisLessons(entrada: EntradaThesisLessons): ThesisLessons {
  const { story, roicComparacaoSetor, carryComparacaoSetor } = entrada;

  const caracteristicasCompounder =
    story.oQueFortalece.length > 0
      ? story.oQueFortalece
      : ["Nenhuma característica de força identificada pelo Explanation Engine hoje."];

  const errosQuePodemDestruir =
    story.oQueEnfraquece.length > 0 ? story.oQueEnfraquece : [story.principalRisco];

  const frasesSetor = [fraseDiferencial("ROIC", roicComparacaoSetor), fraseDiferencial("Carry", carryComparacaoSetor)].filter(
    (f): f is string => f !== null
  );
  const diferencialConcorrentes =
    frasesSetor.length > 0
      ? `${frasesSetor.join("; ")} — comparação transversal com empresas do mesmo setor, não histórica.`
      : "Sem comparação de setor disponível hoje — setor não classificado ou sem outra empresa do mesmo setor com dado suficiente.";

  return { caracteristicasCompounder, errosQuePodemDestruir, diferencialConcorrentes };
}
