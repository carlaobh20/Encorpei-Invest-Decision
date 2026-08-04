import type { NivelConfianca } from "./proveniencia";
import type { Verificacao } from "./auditoria";

/**
 * DATA CONFIDENCE (Bloco 2, Sprint 2.4, Módulo 1 — Truth Layer).
 *
 * Selo de 1 a 5 estrelas por indicador. Regras determinísticas, NUNCA IA
 * (a spec pede isso explicitamente) — combina sinais que já existem no
 * sistema:
 *  - confiabilidade da fonte (`NivelConfianca`, já usado em ~11 arquivos);
 *  - verificações de integridade já feitas pelo FDIE (`auditoria.ts`);
 *  - idade do dado (atualização);
 *  - divergência conhecida com outra fonte — hoje SEMPRE `false`, porque o
 *    Módulo 4 (Multi-Source Validation) não está implementado ainda (ver
 *    truth-missing-data.ts, id "multi_source_validation_nao_decidida");
 *    nunca inventar uma divergência que não foi medida.
 *  - presença de linhagem completa (Data Lineage, Módulo 2).
 *
 * 5 estrelas nunca significa "perfeito para sempre" — significa "todo
 * sinal que o sistema sabe medir hoje está favorável". Se o sistema passar
 * a medir mais sinais (ex.: Multi-Source Validation), a nota pode cair
 * mesmo sem o dado ter mudado — isso é o comportamento CORRETO (mais
 * verificação disponível = régua mais rigorosa), não um bug.
 */

export type Estrelas = 1 | 2 | 3 | 4 | 5;

export type EntradaDataConfidence = {
  confiabilidadeFonte: NivelConfianca;
  /** dias desde o dado mais recente; null = idade desconhecida (não conta a favor nem contra) */
  idadeDias: number | null;
  /** verificações do FDIE já rodadas para este indicador/empresa — [] é uma resposta honesta (nenhuma verificação aplicável), não erro */
  verificacoesFdie: Verificacao[];
  /** true só quando o Módulo 4 (Multi-Source Validation) efetivamente mediu e achou divergência — hoje é sempre false, nunca inferido */
  divergenciaConhecida: boolean;
  /** true quando existe proveniência completa (fonte, hash, timestamp) para este dado */
  temLineage: boolean;
};

export type DataConfidence = {
  estrelas: Estrelas;
  motivos: string[];
};

export function calcularDataConfidence(e: EntradaDataConfidence): DataConfidence {
  let pontos = 0;
  const motivos: string[] = [];

  if (e.confiabilidadeFonte === "alta") {
    pontos += 2;
    motivos.push("Fonte de confiabilidade alta.");
  } else if (e.confiabilidadeFonte === "media") {
    pontos += 1;
    motivos.push("Fonte de confiabilidade média.");
  } else {
    motivos.push("Fonte de confiabilidade baixa.");
  }

  const temCritico = e.verificacoesFdie.some((v) => v.severidade === "critico");
  const temAlerta = e.verificacoesFdie.some((v) => v.severidade === "alerta");
  if (temCritico) {
    motivos.push("Há verificação de integridade CRÍTICA sem resolver — nota não sobe até isso ser checado.");
  } else if (temAlerta) {
    motivos.push("Há alerta de integridade pendente — nota não sobe até resolver.");
  } else if (e.verificacoesFdie.length > 0) {
    pontos += 1;
    motivos.push(`${e.verificacoesFdie.length} verificação(ões) de integridade (FDIE) passaram sem alerta.`);
  } else {
    motivos.push("Nenhuma verificação de integridade aplicável a este indicador ainda.");
  }

  if (e.idadeDias === null) {
    motivos.push("Data do dado mais recente desconhecida.");
  } else if (e.idadeDias <= 7) {
    pontos += 1;
    motivos.push("Atualizado nos últimos 7 dias.");
  } else if (e.idadeDias > 90) {
    motivos.push(`Sem atualização há ${e.idadeDias} dias (mais de 90).`);
  }

  if (e.divergenciaConhecida) {
    pontos -= 1;
    motivos.push("Divergência conhecida com outra fonte de dado — nota reduzida.");
  } else {
    motivos.push("Nenhuma divergência conhecida (Multi-Source Validation ainda não implementado — isto NÃO é a mesma coisa que 'confirmado por outra fonte').");
  }

  if (e.temLineage) {
    pontos += 1;
    motivos.push("Linhagem completa disponível (origem, hash, timestamp).");
  } else {
    motivos.push("Sem linhagem registrada para este dado.");
  }

  const estrelas = Math.max(1, Math.min(5, pontos)) as Estrelas;
  return { estrelas, motivos };
}
