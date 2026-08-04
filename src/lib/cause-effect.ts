import type { Evidencia, EvidenciaCategoria } from "./evidence";
import type { NivelConfianca } from "./proveniencia";

/**
 * CAUSE & EFFECT ENGINE (Foundation v4 — Módulo 2).
 *
 * "Não é responder O QUE aconteceu, é responder POR QUE" — pedido explícito
 * de uma árvore causal (Carry caiu → Lucro caiu → Margem caiu → Custos
 * aumentaram → Matéria-prima encareceu), nunca uma lista plana de eventos.
 *
 * Corte honesto sobre o que este motor REALMENTE faz: não existe, hoje, um
 * mecanismo de inferência causal comprovada no sistema (nenhum modelo de
 * ML, nenhuma regra que "prove" que X causou Y). O que este motor monta é
 * uma árvore de PLAUSIBILIDADE — liga um evento raiz às evidências ativas
 * cuja categoria é uma causa plausível conhecida (`RELACOES_CAUSAIS_PADRAO`,
 * abaixo, editável e versionável), e para exatamente onde a evidência para.
 * Se não existe evidência de "custos" ou "matéria-prima" registrada para o
 * ticker, a árvore do exemplo da especificação vai parar em "Margem caiu"
 * com filhos vazios — isso é o comportamento certo (nunca inventar o elo
 * seguinte), não uma limitação a esconder.
 *
 * Cada nó carrega a `categoria` e a `confiabilidade` da evidência que o
 * originou — quem consumir a árvore sabe exatamente o quão firme é cada
 * elo, em vez de uma cadeia apresentada como fato.
 */

export type OrigemNoCausal = "evento" | "evidencia";

/**
 * Categoria de um NÓ da árvore causal — mais ampla que `EvidenciaCategoria`
 * porque a RAIZ da árvore costuma ser um evento de domínio (ex.: "carry"
 * caiu) que não é, em si, uma categoria de evidência coletável. Nós
 * derivados de evidência (não-raiz) sempre carregam uma `EvidenciaCategoria`
 * de verdade — só a raiz pode usar um valor fora desse conjunto.
 */
export type CategoriaCausal = EvidenciaCategoria | "carry";

export type NoArvoreCausal = {
  nivel: number;
  descricao: string;
  origem: OrigemNoCausal;
  categoria: CategoriaCausal | null;
  confiabilidade: NivelConfianca | null;
  filhos: NoArvoreCausal[];
};

export type MapaRelacaoCategorias = Partial<Record<CategoriaCausal, EvidenciaCategoria[]>>;

/**
 * O que plausivelmente EXPLICA cada categoria — não é "X causa Y", é "Y é
 * um dos lugares que vale olhar para explicar X". Editável por quem chama;
 * versão inicial documentada aqui, calibrável quando houver casos reais
 * suficientes para revisar (Research Lab, Módulo 11).
 */
export const RELACOES_CAUSAIS_PADRAO: MapaRelacaoCategorias = {
  carry: ["roic", "margem", "receita"],
  roic: ["margem", "receita"],
  margem: ["receita", "custos"],
  receita: ["macro_selic", "macro_focus", "custos"],
};

function evidenciasQueExplicam(
  categoria: CategoriaCausal | null,
  evidencias: Evidencia[],
  mapa: MapaRelacaoCategorias
): Evidencia[] {
  if (!categoria) return [];
  const categoriasCausa = mapa[categoria] ?? [];
  return evidencias.filter((e) => e.status === "ativa" && categoriasCausa.includes(e.categoria));
}

export type OpcoesArvoreCausal = {
  mapa?: MapaRelacaoCategorias;
  /** limite de profundidade — trava contra cadeias artificialmente longas, não contra ciclos (ciclos já são bloqueados por categoria visitada) */
  profundidadeMaxima?: number;
};

/**
 * Monta a árvore causal a partir de um evento raiz (ex.: "Carry caiu de
 * 8% para 5%", categoria 'carry') e das evidências ativas disponíveis.
 * Função pura — nunca busca dado, nunca afirma causalidade provada.
 */
export function montarArvoreCausal(
  descricaoRaiz: string,
  categoriaRaiz: CategoriaCausal | null,
  evidencias: Evidencia[],
  opcoes: OpcoesArvoreCausal = {}
): NoArvoreCausal {
  const mapa = opcoes.mapa ?? RELACOES_CAUSAIS_PADRAO;
  const profundidadeMaxima = opcoes.profundidadeMaxima ?? 5;

  function construir(
    descricao: string,
    categoria: CategoriaCausal | null,
    origem: OrigemNoCausal,
    confiabilidade: NivelConfianca | null,
    nivel: number,
    categoriasNoCaminho: Set<CategoriaCausal>
  ): NoArvoreCausal {
    const proximoCaminho = categoria ? new Set([...categoriasNoCaminho, categoria]) : categoriasNoCaminho;
    const candidatas =
      nivel >= profundidadeMaxima
        ? []
        : evidenciasQueExplicam(categoria, evidencias, mapa).filter((e) => !categoriasNoCaminho.has(e.categoria));

    const filhos = candidatas.map((e) => construir(e.descricao, e.categoria, "evidencia", e.confiabilidade, nivel + 1, proximoCaminho));

    return { nivel, descricao, origem, categoria, confiabilidade, filhos };
  }

  return construir(descricaoRaiz, categoriaRaiz, "evento", null, 0, new Set());
}

/** Conta quantos nós a árvore tem no total (raiz inclusive) — útil pra medir "quão fundo a explicação foi". */
export function contarNos(no: NoArvoreCausal): number {
  return 1 + no.filhos.reduce((acc, f) => acc + contarNos(f), 0);
}

/** Profundidade máxima efetivamente alcançada (0 = só a raiz, sem nenhuma evidência encadeada). */
export function profundidadeAlcancada(no: NoArvoreCausal): number {
  if (no.filhos.length === 0) return no.nivel;
  return Math.max(...no.filhos.map(profundidadeAlcancada));
}
