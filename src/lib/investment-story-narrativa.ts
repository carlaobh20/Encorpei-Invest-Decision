import type { Decision } from "./decision-object";
import type { ModeloAnalise } from "./setores";
import { ROTULO_MODELO } from "./setores";

/**
 * INVESTMENT STORY (Bloco 2 — Sprint 2.2, Empresas, Seção 1).
 *
 * "A IA deverá montar uma narrativa baseada EXCLUSIVAMENTE em evidências
 * existentes... utilizar apenas Explanation Engine + Evidence Engine" —
 * regra levada ao pé da letra: NENHUM texto aqui vem do campo livre
 * `teses.texto` (redigido por humano/sistema em outro momento, não é saída
 * de motor) nem de qualquer outra fonte. Só `Decision.explanation`
 * (motivosPositivos/negativos, já com `texto`+`origem`+`peso` prontos) e
 * `Decision.evidences` (Evidence Engine) alimentam a narrativa.
 *
 * Corte honesto registrado: `Decision.evidences` está sempre `[]` em
 * produção hoje — nenhum coletor grava a tabela `evidencias` ainda (ver
 * `evidence.ts`). A Investment Story sai inteira do Explanation Engine
 * (Confluence + Carry + FDIE já reclassificados) até isso mudar; o campo
 * `evidenciasUsadas` sempre `0` é o jeito de mostrar essa ausência sem
 * escondê-la, não um bug.
 *
 * Template determinístico (mesmo espírito de `decision-center-narrativa.ts`)
 * — sem LLM configurado no ambiente.
 */

export type InvestmentStory = {
  quemE: string;
  porQueInteressante: string;
  oQueFortalece: string[];
  oQueEnfraquece: string[];
  principalRisco: string;
  principalCatalisador: string;
  evidenciasUsadas: number;
};

export type EntradaInvestmentStory = {
  ticker: string;
  empresa: string;
  setor: string | null;
  modeloNegocio: ModeloAnalise | null;
  decision: Decision;
};

/** Monta a Investment Story — função pura, template determinístico, só Explanation Engine + Evidence Engine como fonte. */
export function gerarInvestmentStory(entrada: EntradaInvestmentStory): InvestmentStory {
  const { ticker, empresa, setor, modeloNegocio, decision } = entrada;
  const { explanation, evidences } = decision;

  const modeloTxt = modeloNegocio ? ROTULO_MODELO[modeloNegocio] : "modelo de negócio não classificado";
  const quemE = `${empresa} (${ticker}) — ${setor ?? "setor não informado"}, ${modeloTxt}.`;

  const topPositivo = explanation.motivosPositivos[0] ?? null;
  const topNegativo = explanation.motivosNegativos[0] ?? null;

  const porQueInteressante =
    decision.confluence !== null
      ? `Confluence Score ${decision.confluence} (convicção ${decision.conviccao}).${topPositivo ? ` ${topPositivo.texto}` : ""}`
      : "Confluence indisponível hoje — sem componente calculável o suficiente para julgar se a empresa continua interessante.";

  const oQueFortalece = explanation.motivosPositivos.slice(0, 3).map((m) => m.texto);
  const oQueEnfraquece = explanation.motivosNegativos.slice(0, 3).map((m) => m.texto);

  const principalRisco = topNegativo?.texto ?? "Nenhum motivo negativo relevante identificado pelo Explanation Engine hoje.";
  const principalCatalisador = topPositivo?.texto ?? "Nenhum catalisador identificado pelo Explanation Engine hoje.";

  return {
    quemE,
    porQueInteressante,
    oQueFortalece,
    oQueEnfraquece,
    principalRisco,
    principalCatalisador,
    evidenciasUsadas: evidences.length,
  };
}
