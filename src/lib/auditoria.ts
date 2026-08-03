import { indicadorPermitido, modeloDe, type ModeloAnalise } from "./setores";

/**
 * MOTOR DE INTEGRIDADE DE DADOS — v1 (fundação do FDIE).
 *
 * Escopo desta v1, deliberadamente pequeno: verificações CRUZADAS e
 * INTERNAS, usando SÓ dados que o sistema já coleta de fontes oficiais
 * (CVM, brapi). Nenhuma chamada nova a API externa, nenhum custo novo,
 * nenhum dado inventado — é auditoria, não decoração.
 *
 * O que NÃO está aqui (e por quê): comparação com Fundamentus/Status
 * Invest/TradingView/etc. exige contratar APIs pagas ou fazer scraping —
 * decisão de custo e risco que só o Carlos toma. Rastreabilidade até a
 * PÁGINA de um PDF da CVM também não está aqui: o pipeline lê os dados
 * estruturados que a CVM publica (XBRL/JSON), não escaneia páginas de
 * PDF — então "página 76" não existe para citar. Ver roadmap/fdie-fase1.md
 * para o que fica para depois e por quê.
 */

export type Severidade = "ok" | "alerta" | "critico";

export type Verificacao = {
  id: string;
  nome: string;
  severidade: Severidade;
  mensagem: string;
};

const BANDAS_DIVERGENCIA = { alerta: 0.02, tarefa: 0.05, bloqueio: 0.1 } as const;

function severidadeDivergencia(diffAbs: number): { sev: Severidade; rotulo: string } {
  if (diffAbs < BANDAS_DIVERGENCIA.alerta) return { sev: "ok", rotulo: "dentro da margem (<2%)" };
  if (diffAbs < BANDAS_DIVERGENCIA.tarefa) return { sev: "alerta", rotulo: "divergência pequena (2-5%)" };
  if (diffAbs < BANDAS_DIVERGENCIA.bloqueio) return { sev: "alerta", rotulo: "divergência moderada (5-10%) — merece checagem" };
  return { sev: "critico", rotulo: "divergência > 10% — indicador não deveria ser publicado assim" };
}

/** 1) Valor de mercado: cotação × ações em circulação vs. o que a brapi devolveu bruto. */
export function checarValorMercado(input: {
  ticker: string;
  cotacao: number | null;
  qtdAcoes: number | null;
  marketCapBruto: number | null;
}): Verificacao | null {
  const { ticker, cotacao, qtdAcoes, marketCapBruto } = input;
  if (cotacao === null || qtdAcoes === null || marketCapBruto === null || marketCapBruto === 0) return null;
  const calculado = cotacao * qtdAcoes;
  const diff = Math.abs(calculado - marketCapBruto) / marketCapBruto;
  const { sev, rotulo } = severidadeDivergencia(diff);
  return {
    id: `${ticker}:valor_mercado`,
    nome: "Valor de mercado = cotação × ações",
    severidade: sev,
    mensagem:
      sev === "ok"
        ? `Cotação × ações (${fmt(calculado)}) bate com o valor de mercado da fonte (${fmt(marketCapBruto)}).`
        : `Cotação × ações dá ${fmt(calculado)}, mas a fonte reportou ${fmt(marketCapBruto)} (${rotulo}). Provável causa: número de ações desatualizado (empresa fez recompra/emissão) ou fonte usando lote diferente.`,
  };
}

/** 2) Margem líquida nunca pode ser maior que a margem bruta — fato contábil, não estimativa. */
export function checarMargens(input: {
  ticker: string;
  margemBruta: number | null;
  margemLiquida: number | null;
}): Verificacao | null {
  const { ticker, margemBruta, margemLiquida } = input;
  if (margemBruta === null || margemLiquida === null) return null;
  const ok = margemLiquida <= margemBruta + 0.001; // folga de arredondamento
  return {
    id: `${ticker}:margem_liquida_vs_bruta`,
    nome: "Margem líquida ≤ margem bruta",
    severidade: ok ? "ok" : "critico",
    mensagem: ok
      ? `Margem líquida (${pct(margemLiquida)}) ≤ margem bruta (${pct(margemBruta)}), como deveria ser.`
      : `IMPOSSÍVEL: margem líquida (${pct(margemLiquida)}) maior que a margem bruta (${pct(margemBruta)}). Um dos dois veio errado do parser — bloquear até checar a fonte.`,
  };
}

/** 3) Margem líquida reportada vs. recalculada (lucro ÷ receita) — pega bug de escala/parser. */
export function checarMargemRecalculada(input: {
  ticker: string;
  receita: number | null;
  lucro: number | null;
  margemLiquida: number | null;
}): Verificacao | null {
  const { ticker, receita, lucro, margemLiquida } = input;
  if (receita === null || receita === 0 || lucro === null || margemLiquida === null) return null;
  const recalculada = lucro / receita;
  const diff = Math.abs(recalculada - margemLiquida) / Math.max(Math.abs(margemLiquida), 0.0001);
  const { sev, rotulo } = severidadeDivergencia(diff);
  return {
    id: `${ticker}:margem_recalculada`,
    nome: "Margem líquida recalculada (lucro ÷ receita)",
    severidade: sev,
    mensagem:
      sev === "ok"
        ? `Lucro ÷ receita (${pct(recalculada)}) bate com a margem líquida reportada (${pct(margemLiquida)}).`
        : `Lucro ÷ receita dá ${pct(recalculada)}, mas o campo margem_liquida guarda ${pct(margemLiquida)} (${rotulo}). Foi assim que o bug de escala do ROIC da INTB3 apareceu em 31/07 — vale a mesma checagem manual na fonte.`,
  };
}

/** 4) Indicador vazando para um modelo de negócio que o exclui (ex.: ROIC de banco). */
export function checarIndicadorSetorial(input: {
  ticker: string;
  indicador: string;
  rotuloIndicador: string;
  valor: number | null;
}): Verificacao | null {
  const { ticker, indicador, rotuloIndicador, valor } = input;
  const modelo = modeloDe(ticker);
  if (!modelo || valor === null) return null;
  const permitido = indicadorPermitido(ticker, indicador);
  return {
    id: `${ticker}:setorial:${indicador}`,
    nome: `${rotuloIndicador} compatível com o modelo (${modelo})`,
    severidade: permitido ? "ok" : "critico",
    mensagem: permitido
      ? `${rotuloIndicador} é um indicador válido para o modelo ${modelo}.`
      : `${rotuloIndicador} não faz sentido para o modelo ${modelo} (regra do Sector Intelligence) mas apareceu com valor ${valor} — não deveria ser exibido nem entrar em nenhuma nota.`,
  };
}

/** 5) Caixa não pode ser negativo — fato contábil (é saldo de conta, não posição líquida). */
export function checarCaixaNegativo(input: { ticker: string; caixa: number | null }): Verificacao | null {
  const { ticker, caixa } = input;
  if (caixa === null) return null;
  const ok = caixa >= 0;
  return {
    id: `${ticker}:caixa_negativo`,
    nome: "Caixa (saldo de conta) não pode ser negativo",
    severidade: ok ? "ok" : "critico",
    mensagem: ok
      ? `Caixa reportado (${fmt(caixa)}) é um valor válido (≥ 0).`
      : `Caixa reportado como negativo (${fmt(caixa)}) — caixa é saldo de conta, nunca pode ser negativo. Erro de sinal ou de mapeamento de campo no parser.`,
  };
}

export type EmpresaAuditavel = {
  ticker: string;
  modelo: ModeloAnalise | null;
  cotacao: number | null;
  qtdAcoes: number | null;
  marketCapBruto: number | null;
  receita: number | null;
  lucro: number | null;
  margemBruta: number | null;
  margemLiquida: number | null;
  roic: number | null;
  dividaLiquida: number | null;
  caixa: number | null;
};

/** Roda todas as verificações aplicáveis para uma empresa; ignora as que faltam dado (nunca estima). */
export function auditarEmpresa(e: EmpresaAuditavel): Verificacao[] {
  const out: Verificacao[] = [];
  const add = (v: Verificacao | null) => {
    if (v) out.push(v);
  };
  add(checarValorMercado({ ticker: e.ticker, cotacao: e.cotacao, qtdAcoes: e.qtdAcoes, marketCapBruto: e.marketCapBruto }));
  add(checarMargens({ ticker: e.ticker, margemBruta: e.margemBruta, margemLiquida: e.margemLiquida }));
  add(checarMargemRecalculada({ ticker: e.ticker, receita: e.receita, lucro: e.lucro, margemLiquida: e.margemLiquida }));
  add(checarIndicadorSetorial({ ticker: e.ticker, indicador: "roic", rotuloIndicador: "ROIC", valor: e.roic }));
  add(
    checarIndicadorSetorial({
      ticker: e.ticker,
      indicador: "divida_liquida",
      rotuloIndicador: "Dívida líquida",
      valor: e.dividaLiquida,
    })
  );
  add(checarCaixaNegativo({ ticker: e.ticker, caixa: e.caixa }));
  return out;
}

export function resumoSeveridade(verificacoes: Verificacao[]): { ok: number; alerta: number; critico: number; total: number } {
  const ok = verificacoes.filter((v) => v.severidade === "ok").length;
  const alerta = verificacoes.filter((v) => v.severidade === "alerta").length;
  const critico = verificacoes.filter((v) => v.severidade === "critico").length;
  return { ok, alerta, critico, total: verificacoes.length };
}

function fmt(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
function pct(v: number): string {
  return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
