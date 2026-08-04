/**
 * PAINEL DE AUDITORIA DA MEMORY LAYER (Bloco 2, Sprint 2.3).
 *
 * Função pura de agregação — só conta o que já está em `evidencias` e em
 * `evidencias_coleta_log`. Não decide nada, não interpreta nada; existe
 * para o Carlos enxergar se a coleta está funcionando (quantidade por
 * empresa/categoria/origem/qualidade) sem precisar abrir o Supabase.
 */

export type LinhaEvidenciaAuditoria = {
  ticker: string;
  categoria: string;
  origem: string;
  confiabilidade: string;
  status: string;
  data: string;
};

export type ResumoAuditoriaMemoria = {
  total: number;
  ativas: number;
  porEmpresa: { ticker: string; total: number }[];
  porCategoria: { categoria: string; total: number }[];
  porOrigem: { origem: string; total: number }[];
  porConfiabilidade: { confiabilidade: string; total: number }[];
  ultimos30dias: number;
};

function contarPor<T>(linhas: T[], chave: (l: T) => string): { chave: string; total: number }[] {
  const mapa = new Map<string, number>();
  for (const l of linhas) {
    const k = chave(l);
    mapa.set(k, (mapa.get(k) ?? 0) + 1);
  }
  return [...mapa.entries()].map(([chave, total]) => ({ chave, total })).sort((a, b) => b.total - a.total);
}

export function resumirAuditoriaMemoria(linhas: LinhaEvidenciaAuditoria[], agora: string): ResumoAuditoriaMemoria {
  const corte30d = new Date(new Date(agora).getTime() - 30 * 24 * 3_600_000).toISOString().slice(0, 10);
  return {
    total: linhas.length,
    ativas: linhas.filter((l) => l.status === "ativa").length,
    porEmpresa: contarPor(linhas, (l) => l.ticker).map((r) => ({ ticker: r.chave, total: r.total })),
    porCategoria: contarPor(linhas, (l) => l.categoria).map((r) => ({ categoria: r.chave, total: r.total })),
    porOrigem: contarPor(linhas, (l) => l.origem).map((r) => ({ origem: r.chave, total: r.total })),
    porConfiabilidade: contarPor(linhas, (l) => l.confiabilidade).map((r) => ({ confiabilidade: r.chave, total: r.total })),
    ultimos30dias: linhas.filter((l) => l.data >= corte30d).length,
  };
}

export type LinhaLogColeta = {
  coletor: string;
  criadoEm: string;
  quantidadeNovas: number;
  quantidadeIgnoradasDuplicadas: number;
  quantidadeErros: number;
};

export type ResumoLogsColeta = {
  execucoesTotal: number;
  novasTotal: number;
  duplicadasTotal: number;
  errosTotal: number;
  porColetor: { coletor: string; execucoes: number; novas: number; duplicadas: number; erros: number; ultimaExecucao: string }[];
};

/** Agrega execuções de coleta — usado pelo painel pra mostrar "coleta está viva?" por coletor. */
export function resumirLogsColeta(logs: LinhaLogColeta[]): ResumoLogsColeta {
  const porColetor = new Map<string, { execucoes: number; novas: number; duplicadas: number; erros: number; ultimaExecucao: string }>();
  for (const l of logs) {
    const atual = porColetor.get(l.coletor) ?? { execucoes: 0, novas: 0, duplicadas: 0, erros: 0, ultimaExecucao: l.criadoEm };
    atual.execucoes += 1;
    atual.novas += l.quantidadeNovas;
    atual.duplicadas += l.quantidadeIgnoradasDuplicadas;
    atual.erros += l.quantidadeErros;
    if (l.criadoEm > atual.ultimaExecucao) atual.ultimaExecucao = l.criadoEm;
    porColetor.set(l.coletor, atual);
  }
  return {
    execucoesTotal: logs.length,
    novasTotal: logs.reduce((a, l) => a + l.quantidadeNovas, 0),
    duplicadasTotal: logs.reduce((a, l) => a + l.quantidadeIgnoradasDuplicadas, 0),
    errosTotal: logs.reduce((a, l) => a + l.quantidadeErros, 0),
    porColetor: [...porColetor.entries()].map(([coletor, v]) => ({ coletor, ...v })).sort((a, b) => b.ultimaExecucao.localeCompare(a.ultimaExecucao)),
  };
}
