/**
 * DECISION JOURNAL (Foundation v3 — Módulo 5).
 *
 * Decisão arquitetural (documentada, não escondida): a especificação pede
 * "criar um banco imutável" para registrar decisão/data/empresa/contexto/
 * motivo/Confluence/Carry/Macro/Technical/Consensus/Portfolio/status. Isso
 * já existe: a tabela `decisoes` (migração 007) é INSERT-only desde o dia 1
 * (revoke update/delete até para service_role — regra de fundação #2) e já
 * guarda ticker, decisão, justificativa, `contexto` (jsonb) e timestamp.
 *
 * Criar uma SEGUNDA tabela imutável fragmentaria a fonte única de verdade
 * das decisões — pior para auditoria, não melhor. A decisão foi: manter
 * `decisoes` como o Decision Journal oficial e enriquecer o payload de
 * `contexto` com a foto completa que o Módulo 2 (Confluence v2) e o Carry
 * agora produzem. Este arquivo só monta esse payload — não decide nada, não
 * escreve no banco (isso é encanamento de rota, fora do domínio; ver
 * pendência de wiring no relatório final do Bloco 1).
 *
 * `contexto.versao` existe desde já para o dia em que o formato mudar de
 * novo — mesma disciplina de versionamento do resto do sistema.
 */

import type { ConfluenciaV2Resultado } from "./confluencia";

export type ContextoDecisaoV2 = {
  versaoContexto: 2;
  ticker: string;
  statusTese: string | null;
  scoreFinal: number | null;
  confluenceV2: ConfluenciaV2Resultado | null;
  carryReal: number | null;
  carryVersao: number | null;
  technicalScore: number | null;
  precoNaDecisao: number | null;
  /** resumo de severidade da auditoria FDIE no momento da decisão — ver auditoria.ts */
  fdieResumo: { ok: number; alerta: number; critico: number; total: number } | null;
};

export type EntradaContextoDecisao = {
  ticker: string;
  statusTese: string | null;
  scoreFinal: number | null;
  confluenceV2: ConfluenciaV2Resultado | null;
  carryReal: number | null;
  carryVersao: number | null;
  technicalScore: number | null;
  precoNaDecisao: number | null;
  fdieResumo: { ok: number; alerta: number; critico: number; total: number } | null;
};

/**
 * Monta a "foto" completa a gravar em `decisoes.contexto` no momento do
 * registro de uma decisão. Função pura — sem I/O, sem Supabase.
 */
export function montarContextoDecisao(entrada: EntradaContextoDecisao): ContextoDecisaoV2 {
  return {
    versaoContexto: 2,
    ticker: entrada.ticker,
    statusTese: entrada.statusTese,
    scoreFinal: entrada.scoreFinal,
    confluenceV2: entrada.confluenceV2,
    carryReal: entrada.carryReal,
    carryVersao: entrada.carryVersao,
    technicalScore: entrada.technicalScore,
    precoNaDecisao: entrada.precoNaDecisao,
    fdieResumo: entrada.fdieResumo,
  };
}
