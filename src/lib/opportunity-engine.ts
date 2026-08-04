import { MARKET_SCAN_CONFIG as CFG } from "./market-scan-config";
import type { MudancaEvento } from "./market-scan-change-detection";

/**
 * OPPORTUNITY ENGINE (Bloco 2, Sprint 2.10, Módulo 3).
 *
 * "Nunca utilizar apenas notas" — lido ao pé da letra: o nível de
 * oportunidade NUNCA vem de um único score cruzando um corte. Precisa de
 * DOIS sinais concordando (Confluence — já é, por si, uma composição de 7
 * componentes do Decision Object — E Carry real acima de um piso), e para
 * os 2 níveis mais altos (Rara/Excepcional) precisa ADICIONALMENTE de pelo
 * menos uma mudança real detectada pelo Change Detection apontando na
 * mesma direção (`melhorou`). Nenhum cálculo novo — só composição sobre
 * `Decision.confluence`/`Decision.carry` (já resolvidos pelo Foundation)
 * e sobre a saída do módulo de Change Detection (Sprint 2.10, Módulo 2).
 */

export type NivelOportunidade = "oportunidade" | "boa" | "forte" | "rara" | "excepcional";

export type ResultadoOportunidade = {
  ticker: string;
  nivel: NivelOportunidade | null;
  porQueApareceu: string;
  oQueMudou: string;
  risco: string;
  confianca: "alta" | "media" | "baixa";
};

export type EntradaOportunidade = {
  ticker: string;
  confluence: number | null;
  carry: number | null;
  riscoTexto: string | null; // ex.: Decision.risk.motivo ou expectedDrawdown já formatado — nunca recalculado aqui
  fdieCritico: boolean;
  mudancasRecentes: MudancaEvento[]; // saída do Módulo 2, já filtrada pro ticker
};

function bandaPorConfluence(confluence: number): NivelOportunidade | null {
  const b = CFG.bandasConfluence;
  if (confluence >= b.excepcional) return "excepcional";
  if (confluence >= b.rara) return "rara";
  if (confluence >= b.forte) return "forte";
  if (confluence >= b.boa) return "boa";
  if (confluence >= b.oportunidade) return "oportunidade";
  return null;
}

export function avaliarOportunidade(entrada: EntradaOportunidade): ResultadoOportunidade | null {
  const { ticker, confluence, carry, riscoTexto, fdieCritico, mudancasRecentes } = entrada;

  if (confluence === null) return null;
  let nivel = bandaPorConfluence(confluence);
  if (nivel === null) return null;

  const mudancasPositivas = mudancasRecentes.filter((m) => m.disponivel && m.direcao === "melhorou");
  const carryAlto = carry !== null && carry >= CFG.carryMinimoRaroAA;

  // Rara/Excepcional exigem sinal concordante extra — nunca só a nota de Confluence.
  if ((nivel === "rara" || nivel === "excepcional") && !(carryAlto && mudancasPositivas.length > 0)) {
    nivel = "forte"; // rebaixado — Confluence sozinha não sustenta o nível mais alto
  }

  // FDIE crítico nunca deixa uma oportunidade subir de nível, mesmo com Confluence alta — corte honesto.
  if (fdieCritico && (nivel === "rara" || nivel === "excepcional")) {
    nivel = "boa";
  }

  const partesMotivo: string[] = [`Confluence ${confluence} entra na banda "${nivel}".`];
  if (carryAlto) partesMotivo.push(`Carry real acima de IPCA+${(CFG.carryMinimoRaroAA * 100).toFixed(0)}%.`);

  const oQueMudou =
    mudancasPositivas.length > 0
      ? mudancasPositivas.map((m) => m.texto).join(" ")
      : "Nenhuma mudança recente detectada com dado disponível — nível reflete o estado atual, não uma tendência.";

  const confianca: "alta" | "media" | "baixa" =
    fdieCritico ? "baixa" : mudancasPositivas.length > 0 ? "alta" : "media";

  return {
    ticker,
    nivel,
    porQueApareceu: partesMotivo.join(" "),
    oQueMudou,
    risco: riscoTexto ?? "Sem sinal de risco dedicado disponível — ver FDIE e Drawdown Esperado na tese.",
    confianca,
  };
}
