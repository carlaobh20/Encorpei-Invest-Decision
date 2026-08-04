import type { Proveniencia } from "./proveniencia";

/**
 * DATA LINEAGE (Bloco 2, Sprint 2.4, Módulo 2 — Truth Layer).
 *
 * Corte honesto registrado ANTES de escrever qualquer linha de código
 * desta sprint: este módulo já existe quase inteiro. `proveniencia.ts`
 * (Foundation v3, Módulo 4, FDIE v2) já cobre Origem/Documento/Versão/
 * Timestamp/Hash/Confiabilidade — e já documenta por que Linha/Página são
 * sempre `null` (a CVM entrega XBRL/JSON estruturado, não PDF escaneado;
 * não é peça faltando, é um dado que a fonte não produz nesse formato).
 *
 * Este arquivo NÃO recria `Proveniencia` — só adiciona os dois campos que
 * a spec do Truth Layer pede e `Proveniencia` não tinha (Tabela, Motor
 * responsável), por composição, sem alterar o tipo congelado do Foundation.
 */

export type Linhagem = Proveniencia & {
  /** nome do indicador a que esta linhagem pertence (ex.: "receita_liquida", "carry_real") */
  indicador: string;
  /** tabela do banco onde o dado vive hoje (ex.: "fundamentos", "carry_score") */
  tabela: string;
  /** nome do arquivo/função que calculou ou coletou este dado (ex.: "src/lib/carry/escada.ts") */
  motorResponsavel: string;
};

export function montarLinhagem(proveniencia: Proveniencia, params: { indicador: string; tabela: string; motorResponsavel: string }): Linhagem {
  return {
    ...proveniencia,
    indicador: params.indicador,
    tabela: params.tabela,
    motorResponsavel: params.motorResponsavel,
  };
}

/** Texto curto pronto pra exibição — "de onde veio esse número", uma linha. */
export function resumoLinhagem(l: Linhagem): string {
  const doc = l.documento ? `, doc. ${l.documento}` : "";
  const versao = l.versao !== null ? `, v${l.versao}` : "";
  return `${l.fonte}${doc}${versao} — tabela ${l.tabela}, calculado por ${l.motorResponsavel} (hash ${l.hash.slice(0, 8)}…).`;
}
