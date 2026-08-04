import type { ResultadoMasterEngine } from "./master-engine";
import { evidenciasAtivasDoTicker, type Evidencia } from "./evidence";

/**
 * DECISION EXPLANATION ENGINE (Foundation v3.1 — Módulo 2).
 *
 * Regra inegociável da especificação, repetida aqui de propósito: "nunca
 * calcular, nunca alterar pesos, nunca alterar nota. Somente explicar."
 * Este módulo não faz NENHUMA conta nova — só reclassifica em "positivo"/
 * "negativo"/"aviso" o que os motores já calcularam e já explicaram por
 * escrito (`componentes` do Confluence v2, `fatores` do Carry, `resumo` do
 * FDIE, `Evidencia.pesoInformativo`). Saída sempre estruturada — nenhuma
 * string livre é gerada aqui; toda IA que consumir isto (para responder
 * perguntas do Carlos) recebe a estrutura, nunca escreve o veredito sozinha.
 */

/** Componente de Confluence com valor >= este limiar entra como motivo positivo. */
export const LIMIAR_POSITIVO = 60;
/** Componente de Confluence com valor <= este limiar entra como motivo negativo. */
export const LIMIAR_NEGATIVO = 40;

export type MotivoExplicacao = {
  texto: string;
  /** de onde veio: "confluence:quality", "carry", "evidencia:margem" etc. */
  origem: string;
  /** peso do componente de origem, quando aplicável (0-1) — nunca inventado, copiado do motor original */
  peso: number | null;
};

export type ExplicacaoDecisao = {
  ticker: string;
  confluenceScore: number | null;
  conviccao: string;
  motivosPositivos: MotivoExplicacao[];
  motivosNegativos: MotivoExplicacao[];
  /** pendências e bloqueios — nunca é "motivo contra a tese", é ausência de dado ou alerta de integridade */
  avisos: string[];
  geradoEm: string;
};

function classificarComponente(valor: number, limiarPositivo: number, limiarNegativo: number): "positivo" | "negativo" | "neutro" {
  if (valor >= limiarPositivo) return "positivo";
  if (valor <= limiarNegativo) return "negativo";
  return "neutro";
}

export type OpcoesExplicacao = {
  limiarPositivo?: number;
  limiarNegativo?: number;
  evidenciasAtivas?: Evidencia[];
};

/**
 * Monta a explicação estruturada a partir de um resultado já calculado pelo
 * Master Engine. Função pura — não recalcula nada, só reorganiza o que já
 * existe em `resultado` (e, opcionalmente, evidências já ativas do ticker).
 */
export function gerarExplicacaoDecisao(
  resultado: ResultadoMasterEngine,
  timestamp: string,
  opcoes: OpcoesExplicacao = {}
): ExplicacaoDecisao {
  const limiarPositivo = opcoes.limiarPositivo ?? LIMIAR_POSITIVO;
  const limiarNegativo = opcoes.limiarNegativo ?? LIMIAR_NEGATIVO;

  const motivosPositivos: MotivoExplicacao[] = [];
  const motivosNegativos: MotivoExplicacao[] = [];
  const avisos: string[] = [];

  // 1) Componentes do Confluence v2 — já vêm com explicação escrita pelo motor original.
  for (const c of resultado.confluence.componentes) {
    if (c.valor === null) {
      avisos.push(`${c.nome}: ${c.explicacao}`);
      continue;
    }
    const classe = classificarComponente(c.valor, limiarPositivo, limiarNegativo);
    const motivo: MotivoExplicacao = { texto: c.explicacao, origem: `confluence:${c.id}`, peso: c.peso };
    if (classe === "positivo") motivosPositivos.push(motivo);
    else if (classe === "negativo") motivosNegativos.push(motivo);
    // "neutro" não vira motivo — não é forte o suficiente pra pesar a explicação nem pra nenhum dos dois lados
  }

  // 2) Fatores do Carry (melhor degrau calculável) — já vêm rotulados "sustenta"/"atencao" pelo motor original.
  if (resultado.carry.melhor.resultado) {
    for (const f of resultado.carry.melhor.resultado.fatores) {
      const motivo: MotivoExplicacao = { texto: f.texto, origem: "carry", peso: null };
      if (f.direcao === "sustenta") motivosPositivos.push(motivo);
      else motivosNegativos.push(motivo);
    }
  } else if (resultado.carry.melhor.pendencia) {
    avisos.push(`Carry: ${resultado.carry.melhor.pendencia}`);
  }

  // 3) FDIE — nunca é motivo a favor/contra da tese, é alerta de confiabilidade do dado.
  if (resultado.fdie.resumo.critico > 0) {
    avisos.push(`FDIE: ${resultado.fdie.resumo.critico} verificação(ões) crítica(s) — checar a fonte antes de confiar nas notas deste ciclo.`);
  } else if (resultado.fdie.resumo.alerta > 0) {
    avisos.push(`FDIE: ${resultado.fdie.resumo.alerta} verificação(ões) em alerta — divergência pequena/moderada, vale checar.`);
  }

  // 4) Evidências ativas do ticker (opcional — Evidence Engine, Módulo 3), classificadas pelo sinal já registrado nelas.
  const evidenciasDoTicker = evidenciasAtivasDoTicker(resultado.ticker, opcoes.evidenciasAtivas ?? []);
  for (const e of evidenciasDoTicker) {
    if (e.pesoInformativo === 0) continue;
    const motivo: MotivoExplicacao = { texto: e.descricao, origem: `evidencia:${e.categoria}`, peso: e.pesoInformativo };
    if (e.pesoInformativo > 0) motivosPositivos.push(motivo);
    else motivosNegativos.push(motivo);
  }

  return {
    ticker: resultado.ticker,
    confluenceScore: resultado.confluence.score,
    conviccao: resultado.confluence.conviccao,
    motivosPositivos,
    motivosNegativos,
    avisos,
    geradoEm: timestamp,
  };
}
