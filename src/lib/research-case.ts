import type { Decision } from "./decision-object";

/**
 * RESEARCH PREPARATION (Foundation v3.1 — Módulo 6).
 *
 * Objetivo futuro (Research Lab, fora deste Bloco): aprender com milhares
 * de observações, não só as dezenas de empresas que já passaram pela
 * carteira ou pelo Radar. Para isso, qualquer empresa analisada — dentro ou
 * fora da carteira — precisa poder virar um "caso histórico" comparável.
 *
 * Este módulo é SÓ infraestrutura de tipos + montagem, como pedido
 * explicitamente ("criar somente a infraestrutura, não criar interface").
 * Reaproveita o Decision Object (Módulo 1) inteiro como o "snapshot" do
 * caso — não redeclara confluence/carry/technical/etc. de novo (Módulo 8:
 * nenhum campo duplicado).
 *
 * DECISÃO ARQUITETURAL EXPLÍCITA: nenhuma tabela nova foi criada para
 * `CasoHistorico` nesta rodada. Diferente do Evidence Engine (Módulo 3,
 * onde o formato de evidência já estava claro o bastante para desenhar
 * schema), o Research Lab ainda não tem consumidor definido — quantas
 * observações por caso, que agregações, que índices seriam necessários.
 * Desenhar uma tabela agora seria adivinhar o formato certo sem saber a
 * pergunta que o Research Lab vai fazer. Ficou registrado como pendência
 * do Bloco 2 (ou de quando o Research Lab for de fato especificado) — ver
 * relatório final.
 */

export type OrigemCasoHistorico = "carteira" | "radar" | "manual";

export type DesfechoCasoHistorico = {
  dataAvaliacao: string;
  retornoRealizado: number | null;
  superouCdi: boolean | null;
  superouIbovespa: boolean | null;
};

export type CasoHistorico = {
  ticker: string;
  /** data em que o snapshot foi tirado (não a data do balanço) */
  dataSnapshot: string;
  origem: OrigemCasoHistorico;
  /** o Decision Object completo no momento do snapshot — nenhum campo duplicado aqui */
  snapshot: Decision;
  /** preenchido só quando há dado suficiente pra julgar o desfecho — null até lá, nunca estimado cedo demais */
  desfecho: DesfechoCasoHistorico | null;
};

/** Transforma um Decision Object já montado em caso histórico — função pura, sem I/O. */
export function montarCasoHistorico(decision: Decision, origem: OrigemCasoHistorico, dataSnapshot: string): CasoHistorico {
  return {
    ticker: decision.ticker,
    dataSnapshot,
    origem,
    snapshot: decision,
    desfecho: null,
  };
}

/**
 * Anexa um desfecho a um caso já existente. Retorna um NOVO objeto (não
 * muta o original) — mesmo espírito imutável do resto do sistema, mesmo
 * sem tabela própria ainda: o snapshot original nunca é reescrito, só
 * ganha um desfecho ao lado.
 */
export function registrarDesfecho(caso: CasoHistorico, desfecho: DesfechoCasoHistorico): CasoHistorico {
  return { ...caso, desfecho };
}
