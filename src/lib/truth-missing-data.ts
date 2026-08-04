/**
 * MISSING DATA REGISTRY (Bloco 2, Sprint 2.4, Módulo 9 — Truth Layer).
 *
 * A spec pede "nunca mostrar só 'dado indisponível' — mostrar qual dado
 * falta, por que falta, de qual integração depende, qual sprint resolve".
 * Isso já vem sendo feito ad-hoc, espalhado em comentário de código e no
 * roadmap, desde o Bloco 1 (FDIE) e reforçado em cada sprint do Bloco 2
 * (Evidence Engine sem coletor, Confluence sem histórico, Valuation sem
 * série persistida, Multi-Source Validation adiada por decisão do Carlos
 * etc.). Este arquivo formaliza isso num registro único, consultável — não
 * inventa nenhuma lacuna nova, só organiza as que já estavam documentadas.
 *
 * Fonte de verdade: este array. Quando uma lacuna for resolvida (migração
 * aplicada, coletor ligado, fonte decidida), remover a entrada — nunca
 * deixar registro "resolvido" acumulando aqui, isso viraria ruído.
 */

export type CategoriaLacuna = "coleta" | "historico" | "motor" | "integracao_externa" | "decisao_pendente";

export type LacunaConhecida = {
  id: string;
  dado: string;
  categoria: CategoriaLacuna;
  motivo: string;
  dependeDe: string;
  sprint: string | null;
  telasAfetadas: string[];
};

export const LACUNAS_CONHECIDAS: LacunaConhecida[] = [
  {
    id: "evidence_engine_categorias_sem_coletor",
    dado: "Evidências de insider_compra, insider_venda, controlador_venda, guidance, regulatorio, fluxo, consenso",
    categoria: "coleta",
    motivo: "Só 6 das 14 categorias de EvidenciaCategoria têm coletor automático hoje (Comunicados/CVM-IPE, Macro/Focus, Resultados/DFP-ITR, Carry) — as demais dependem de registro manual ou de fonte que não existe.",
    dependeDe: "Formulário de Referência (CVM/FRE) e VLMO para controlador; fonte de fluxo institucional/consenso ainda não decidida.",
    sprint: "2.3 Fase B",
    telasAfetadas: ["/tese/[ticker]", "/decisoes"],
  },
  {
    id: "confluence_sem_historico",
    dado: "Confluence Score (Decision Object v2) histórico — Strength ↑/↓",
    categoria: "historico",
    motivo: "O sistema persiste a nota oficial diária (scores) e o Carry v1 diário (carry_score), mas nunca persistiu snapshot do Decision Object — não há dois pontos no tempo para comparar Confluence.",
    dependeDe: "Persistir snapshot diário do Decision Object (mudança de schema, não de motor).",
    sprint: null,
    telasAfetadas: ["/decisoes", "/tese/[ticker]"],
  },
  {
    id: "valuation_sem_serie_persistida",
    dado: "P/L, EV/EBITDA, P/VP, Dividend Yield, FCF — histórico por ticker no tempo",
    categoria: "historico",
    motivo: "Os cálculos existem (radar.ts, marketcap.ts, score.ts) mas não encontrei uma série diária/periódica persistida e reutilizável — sem isso não dá pra mostrar 'como esse múltiplo evoluiu'.",
    dependeDe: "Decidir se persiste um snapshot diário desses múltiplos (tabela nova) ou se recalcula sob demanda a partir de precos_diarios + fundamentos.",
    sprint: null,
    telasAfetadas: ["/tese/[ticker]"],
  },
  {
    id: "multi_source_validation_nao_decidida",
    dado: "Comparação do nosso cálculo com Fundamentus/Status Invest/outra fonte",
    categoria: "decisao_pendente",
    motivo: "Exige contratar API paga ou fazer scraping de terceiro — decisão de custo e risco (ToS, fragilidade de formato) que só o Carlos toma. Já registrado assim em auditoria.ts antes desta sprint.",
    dependeDe: "Decisão do Carlos: qual fonte, paga ou scraping, e aceitar o risco de manutenção.",
    sprint: "2.4 Fase B",
    telasAfetadas: ["/auditoria (Divergence Center)"],
  },
  {
    id: "setor_sem_fonte_dinamica",
    dado: "Mudança de liderança/market share/concorrência/M&A por setor",
    categoria: "integracao_externa",
    motivo: "sector-intelligence (migração 013) é classificação estática (modelo de negócio por empresa), não um feed de eventos de mercado.",
    dependeDe: "Fonte de notícias/market-share estruturada — não decidida.",
    sprint: "2.3 Fase B",
    telasAfetadas: ["Memory Layer — Coletor 12"],
  },
  {
    id: "wealth_engine_sem_contribuicao_marginal",
    dado: "Impacto de UMA posição no CAGR/meta da carteira (Wealth Impact por empresa)",
    categoria: "motor",
    motivo: "Wealth Engine calcula a carteira inteira, não a contribuição marginal de uma posição individual.",
    dependeDe: "Extensão do Wealth Engine (Foundation v4) para decompor por posição — mudança de motor, precisa ratificação.",
    sprint: null,
    telasAfetadas: ["/tese/[ticker]"],
  },
  {
    id: "cause_effect_raso_sem_evidencia",
    dado: "Árvore causal com mais de um nó (Cause & Effect Engine)",
    categoria: "coleta",
    motivo: "O motor é real, mas depende de Evidence — com a Memory Layer (Sprint 2.3) ainda não aplicada em produção, a árvore segue parando na raiz na prática.",
    dependeDe: "Aplicar a migração 023 e rodar /api/evidencias/coletar.",
    sprint: "2.3 Fase A (código pronto, aguardando aplicar migração)",
    telasAfetadas: ["/tese/[ticker]"],
  },
  {
    id: "linha_pagina_documento_cvm",
    dado: "Número de linha/página do documento de origem (Lineage)",
    categoria: "integracao_externa",
    motivo: "O pipeline lê dado estruturado (XBRL/JSON) que a CVM publica, nunca escaneia PDF — não existe linha/página para citar. Não é peça faltando, é um dado que a fonte não produz nesse formato.",
    dependeDe: "Nada — permanece sempre null por design, documentado em proveniencia.ts desde o Foundation v3.",
    sprint: null,
    telasAfetadas: ["Data Lineage (Truth Layer)"],
  },
];

export function lacunasPorCategoria(categoria: CategoriaLacuna): LacunaConhecida[] {
  return LACUNAS_CONHECIDAS.filter((l) => l.categoria === categoria);
}

export function lacunasPorTela(tela: string): LacunaConhecida[] {
  return LACUNAS_CONHECIDAS.filter((l) => l.telasAfetadas.some((t) => t.includes(tela)));
}

export type ResumoLacunas = {
  total: number;
  porCategoria: Record<CategoriaLacuna, number>;
  semSprintDefinida: number;
};

export function resumirLacunas(lacunas: LacunaConhecida[] = LACUNAS_CONHECIDAS): ResumoLacunas {
  const porCategoria: Record<CategoriaLacuna, number> = {
    coleta: 0,
    historico: 0,
    motor: 0,
    integracao_externa: 0,
    decisao_pendente: 0,
  };
  for (const l of lacunas) porCategoria[l.categoria] += 1;
  return {
    total: lacunas.length,
    porCategoria,
    semSprintDefinida: lacunas.filter((l) => l.sprint === null).length,
  };
}
