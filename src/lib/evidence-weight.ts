import type { EvidenciaCategoria } from "./evidence";
import { resumirFatores, type DecisaoComFatores, type ResumoFator } from "./decision-dna";

/**
 * EVIDENCE WEIGHT ENGINE (Foundation v4 — Módulo 11).
 *
 * Regra inegociável da especificação: "peso NUNCA pode ser alterado
 * automaticamente... o Research Lab sugere, o Foundation só guarda". Este
 * arquivo NÃO calcula peso nenhum — ele só RESOLVE, para uma categoria de
 * evidência, qual peso vale hoje, a partir de propostas que já vêm prontas
 * de fora (leitura de `erl.hipoteses`/`erl.aprovacoes`, migração 019). A
 * única fonte de verdade pra mudar um peso é uma linha em `erl.aprovacoes`
 * com `aprovado = true` E `aprovado_por` preenchido — exatamente a mesma
 * regra "PARA sem exceção" já escrita na migração 019. Sem isso, o peso
 * fica no padrão neutro (1) para sempre, não importa quantas hipóteses
 * estejam "em_teste" no Research Lab.
 *
 * "Não criar dois motores resolvendo o mesmo problema": o lado observacional
 * (quanto uma categoria de evidência historicamente acompanhou decisões
 * certas) NÃO ganha um agregador novo aqui — reaproveita `resumirFatores`
 * de decision-dna.ts (Foundation v3, Módulo 7) tratando `categoria` de
 * evidência como mais um `FatorObservado`, com a mesma disciplina de nunca
 * realimentar peso nenhum a partir da observação.
 */

export const PESO_PADRAO = 1;
export const CHAVE_FATOR_EVIDENCIA = "evidenciaCategoria";

/**
 * Uma proposta de peso já lida de `erl.hipoteses` (join `erl.aprovacoes`)
 * por quem chama — este arquivo nunca acessa banco. `aprovado`/`aprovadoPor`
 * espelham as colunas homônimas de `erl.aprovacoes` (aprovado: null =
 * pendente).
 */
export type PropostaPesoEvidencia = {
  categoria: EvidenciaCategoria;
  hipoteseId: number;
  aprovacaoId: number;
  /** multiplicador sugerido pelo Research Lab — ex.: 1.3 = evidência pesa 30% mais que o padrão */
  pesoProposto: number;
  aprovado: boolean | null;
  aprovadoPor: string | null;
  aprovadoEm: string | null;
  justificativa: string;
};

export type ResultadoPesoEvidencia = {
  categoria: EvidenciaCategoria;
  peso: number;
  origem: "padrao" | "aprovado_erl";
  hipoteseId: number | null;
  aprovacaoId: number | null;
  aprovadoPor: string | null;
  motivo: string;
};

function propostaValida(p: PropostaPesoEvidencia): boolean {
  // mesma regra "PARA sem exceção" da migração 019: aprovado=true sem aprovado_por não conta.
  return p.aprovado === true && !!p.aprovadoPor && p.aprovadoPor.trim().length > 0;
}

/**
 * Resolve o peso vigente de UMA categoria de evidência a partir das
 * propostas conhecidas. Função pura — nenhuma leitura de banco aqui, e
 * nenhum cálculo de peso: só escolhe a proposta aprovada mais recente, ou
 * cai no padrão neutro.
 */
export function resolverPesoEvidencia(categoria: EvidenciaCategoria, propostas: PropostaPesoEvidencia[]): ResultadoPesoEvidencia {
  const validas = propostas.filter((p) => p.categoria === categoria && propostaValida(p));

  if (validas.length === 0) {
    const aprovadasSemIdentificacao = propostas.filter((p) => p.categoria === categoria && p.aprovado === true && !propostaValida(p));
    const motivo =
      aprovadasSemIdentificacao.length > 0
        ? `${aprovadasSemIdentificacao.length} proposta(s) marcada(s) aprovada=true para "${categoria}", mas sem aprovado_por preenchido — tratada(s) como não aprovada por segurança (regra da migração 019). Peso padrão (${PESO_PADRAO}) mantido.`
        : `Nenhuma proposta aprovada manualmente para "${categoria}" ainda — peso padrão neutro (${PESO_PADRAO}) aplicado.`;
    return { categoria, peso: PESO_PADRAO, origem: "padrao", hipoteseId: null, aprovacaoId: null, aprovadoPor: null, motivo };
  }

  // mais recente por aprovadoEm; empate/ausência de data cai para o maior aprovacaoId (a aprovação mais nova registrada)
  const escolhida = validas.reduce((melhor, atual) => {
    if (atual.aprovadoEm && melhor.aprovadoEm) return atual.aprovadoEm > melhor.aprovadoEm ? atual : melhor;
    if (atual.aprovadoEm && !melhor.aprovadoEm) return atual;
    if (!atual.aprovadoEm && melhor.aprovadoEm) return melhor;
    return atual.aprovacaoId > melhor.aprovacaoId ? atual : melhor;
  });

  return {
    categoria,
    peso: escolhida.pesoProposto,
    origem: "aprovado_erl",
    hipoteseId: escolhida.hipoteseId,
    aprovacaoId: escolhida.aprovacaoId,
    aprovadoPor: escolhida.aprovadoPor,
    motivo: `Peso aprovado manualmente por ${escolhida.aprovadoPor} (erl.aprovacoes #${escolhida.aprovacaoId}, hipótese erl.hipoteses #${escolhida.hipoteseId}): ${escolhida.justificativa}`,
  };
}

/** Aplica `resolverPesoEvidencia` a várias categorias de uma vez — nenhum cálculo extra, só repetição. */
export function resolverPesosEvidencias(categorias: EvidenciaCategoria[], propostas: PropostaPesoEvidencia[]): ResultadoPesoEvidencia[] {
  return categorias.map((c) => resolverPesoEvidencia(c, propostas));
}

/**
 * Poder preditivo observado por categoria de evidência — reaproveita
 * `resumirFatores` (decision-dna.ts) filtrando pela chave de fator que este
 * motor usa para categorias de evidência. Puramente observacional: nunca
 * realimenta `pesoProposto`/`peso` de nenhuma função acima.
 */
export function resumirPoderPreditivoEvidencias(decisoes: DecisaoComFatores[]): ResumoFator[] {
  return resumirFatores(decisoes).filter((r) => r.chave === CHAVE_FATOR_EVIDENCIA);
}
