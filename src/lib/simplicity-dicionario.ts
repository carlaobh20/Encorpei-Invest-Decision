/**
 * DICIONÁRIO OFICIAL (Bloco 2, Sprint 2.5, Módulos "Padronização" e
 * "Tradução dos Indicadores" — Simplicity Layer).
 *
 * Fonte única de rótulo e definição pros termos e indicadores da
 * plataforma. Qualquer tela que hoje escreve "Confluence Score" ou "P/L"
 * direto no JSX deveria, ao longo das próximas sprints, importar daqui —
 * essa migração NÃO acontece nesta sprint (seria tocar 5 telas de uma vez,
 * risco desnecessário), mas o dicionário já nasce como a fonte que as
 * próximas edições devem consultar.
 *
 * "Nunca usar palavras diferentes para o mesmo conceito" — por isso um
 * termo aqui é um só objeto, nunca duas entradas pro mesmo conceito com
 * nomes diferentes.
 */

export type TermoDicionario = {
  termo: string;
  definicao: string;
};

export const DICIONARIO_TERMOS: Record<string, TermoDicionario> = {
  tese: { termo: "Tese", definicao: "A hipótese de investimento de uma empresa — por que ela merece capital, com os gatilhos que a invalidam se deixarem de ser verdade." },
  confluence: { termo: "Confluence", definicao: "Nota única (0-100) que combina Fundamentos, Carry, Compounder e Technical — quanto os sinais disponíveis apontam na mesma direção." },
  carry: { termo: "Carry", definicao: "Proteção esperada do patrimônio acima da inflação — o retorno real que a empresa entrega enquanto você espera a tese se confirmar." },
  portfolio_fit: { termo: "Portfolio Fit", definicao: "Como uma posição se encaixa na carteira inteira — diversificação, correlação e concentração, nunca um número isolado." },
  conviccao: { termo: "Convicção", definicao: "O quanto o sistema confia na nota que deu — não é a nota em si, é a confiança nela (fundamentada em quantos componentes estavam disponíveis)." },
  catalisador: { termo: "Catalisador", definicao: "Um fator que favorece a tese agora — vindo de um gatilho real disparado ou de um motivo do Explanation Engine." },
  risco: { termo: "Risco", definicao: "Um fator que ameaça a tese agora — mesma origem dos catalisadores, só que na direção contrária." },
  replay: { termo: "Replay", definicao: "A linha do tempo real de como a tese de uma empresa evoluiu — balanços, mudanças de nota, de Carry, de versão da tese." },
  investment_story: { termo: "Investment Story", definicao: "O resumo de quem é a empresa, por que ela interessa, o que a fortalece e o que a enfraquece — só com o que o Explanation Engine e o Evidence Engine realmente sustentam." },
};

export type TraducaoIndicador = {
  indicador: string;
  sigla: string;
  significado: string;
};

export const TRADUCAO_INDICADORES: Record<string, TraducaoIndicador> = {
  carry: { indicador: "Carry", sigla: "Carry", significado: "Proteção esperada do patrimônio acima da inflação." },
  roic: { indicador: "ROIC", sigla: "ROIC", significado: "Eficiência da empresa em transformar capital em lucro." },
  p_l: { indicador: "Preço sobre Lucro", sigla: "P/L", significado: "Quantos anos de lucro o mercado está pagando hoje." },
  p_vp: { indicador: "Preço sobre Valor Patrimonial", sigla: "P/VP", significado: "Quanto o mercado paga sobre o patrimônio líquido." },
  ev_ebitda: { indicador: "Valor da Empresa sobre EBITDA", sigla: "EV/EBITDA", significado: "Quantos anos de geração de caixa operacional o mercado está pagando, já considerando a dívida." },
  margem_liquida: { indicador: "Margem Líquida", sigla: "Margem", significado: "De cada R$100 de receita, quanto sobra de lucro no fim." },
  receita_liquida: { indicador: "Receita Líquida", sigla: "Receita", significado: "Quanto a empresa faturou, já descontados impostos e devoluções." },
  dividend_yield: { indicador: "Dividend Yield", sigla: "DY", significado: "Quanto a empresa pagou em dividendos no ano, como porcentagem do preço da ação." },
  fcf: { indicador: "Fluxo de Caixa Livre", sigla: "FCF", significado: "Quanto dinheiro sobra depois de pagar tudo que é necessário para a empresa operar e crescer." },
  confluence: { indicador: "Confluence Score", sigla: "Confluence", significado: "O quanto os sinais disponíveis (Fundamentos, Carry, Compounder, Técnico) apontam na mesma direção." },
};

export function buscarTermo(chave: string): TermoDicionario | null {
  return DICIONARIO_TERMOS[chave] ?? null;
}

export function buscarTraducaoIndicador(chave: string): TraducaoIndicador | null {
  return TRADUCAO_INDICADORES[chave] ?? null;
}
