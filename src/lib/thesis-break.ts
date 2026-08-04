import { CATEGORIAS_COM_FONTE_HOJE, type EvidenciaCategoria } from "./evidence";

/**
 * THESIS BREAK ENGINE (Foundation v4 — Módulo 3).
 *
 * DECISÃO ARQUITETURAL EXPLÍCITA: "quais fatores quebrariam a tese" é
 * literalmente o que a tabela `gatilhos` (migração 004) já modela —
 * métrica, operador, valor, direção. Este módulo não recria isso; ele
 * REAPROVEITA os gatilhos de direção negativa como a lista oficial de
 * motivos de quebra já monitorados, e ACRESCENTA (nunca inventa dado) os
 * dois motivos que a especificação cita e que hoje não têm gatilho nem
 * coletor: controlador vendendo participação, fluxo institucional
 * vendedor. Esses dois entram como "monitorado: false" — watchlist
 * honesta, não um alerta fabricado.
 */

export type FonteMotivoQuebra = "gatilho" | "evidencia_pendente";

export type MotivoQuebraTese = {
  fonte: FonteMotivoQuebra;
  descricao: string;
  /** true = já existe gatilho/coletor real vigiando isso hoje; false = watchlist, sem fonte de dado ainda */
  monitorado: boolean;
};

export type GatilhoEntrada = {
  descricao: string;
  direcao: "positivo" | "negativo";
  ativo: boolean;
};

/**
 * Motivos de quebra citados na especificação que hoje não têm gatilho nem
 * coletor — mapeados para as categorias correspondentes do Evidence Engine
 * (v3.1). Ficam de fora do `CATEGORIAS_COM_FONTE_HOJE` — se um dia
 * ganharem coletor, o filtro abaixo os move automaticamente para
 * "monitorado" sem precisar editar esta lista.
 */
const MOTIVOS_QUEBRA_SEM_COLETOR_HOJE: { categoria: EvidenciaCategoria; descricao: string }[] = [
  { categoria: "controlador_venda", descricao: "Controlador começou a vender participação relevante" },
  { categoria: "fluxo", descricao: "Fluxo institucional/estrangeiro ficou consistentemente vendedor" },
];

/**
 * Lista os fatores que quebrariam a tese — nunca "a tese piorou", sempre o
 * QUE especificamente quebraria. Função pura, sem I/O.
 */
export function identificarMotivosQuebra(gatilhos: GatilhoEntrada[]): MotivoQuebraTese[] {
  const doGatilho: MotivoQuebraTese[] = gatilhos
    .filter((g) => g.ativo && g.direcao === "negativo")
    .map((g) => ({ fonte: "gatilho", descricao: g.descricao, monitorado: true }));

  const daWatchlist: MotivoQuebraTese[] = MOTIVOS_QUEBRA_SEM_COLETOR_HOJE.filter(
    (m) => !CATEGORIAS_COM_FONTE_HOJE.includes(m.categoria)
  ).map((m) => ({ fonte: "evidencia_pendente", descricao: m.descricao, monitorado: false }));

  return [...doGatilho, ...daWatchlist];
}
