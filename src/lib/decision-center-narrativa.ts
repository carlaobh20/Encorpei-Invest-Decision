import type { DecisaoPrioritaria } from "./decisoes-prioritarias";
import type { LinhaThesisMonitor } from "./thesis-monitor-dados";
import type { SeveridadeAlerta } from "./alertas";

/**
 * CARD IA — "O QUE MERECE MINHA ATENÇÃO HOJE?" (Bloco 2 — Sprint 2.1,
 * Decision Center, Seção 7).
 *
 * SUBSTITUIÇÃO HONESTA registrada com o Carlos antes de codar: a spec
 * descreve este card como se um modelo de linguagem estivesse escrevendo a
 * narrativa em tempo real — mas não há chave de API de LLM configurada no
 * ambiente (CLAUDE.md regra 6, "Regras decidem, IA explica: a API do Claude
 * só redige/explica, nunca pontua" pressupõe uma chave que hoje não existe
 * aqui). Gerar a frase por TEMPLATE determinístico a partir de dado real
 * (em vez de chamar um LLM) é o mesmo espírito da regra 6, só que sem o
 * redator de linguagem natural plugado ainda — nenhum dado é inventado,
 * só a prosa é montada por regra fixa em vez de gerada. Pendência
 * registrada para quando houver chave de LLM: trocar o template por uma
 * chamada real, mantendo a MESMA garantia (nunca decide, só explica).
 */

export type EntradaNarrativaIA = {
  decisoesPrioritarias: DecisaoPrioritaria[];
  thesisMonitor: LinhaThesisMonitor[];
  contagemAlertas: Record<SeveridadeAlerta, number>;
  melhorOportunidade: { ticker: string; carry: number | null } | null;
};

/** Monta a narrativa do card IA — função pura, determinística, por template (não LLM). Nunca decide, só resume o que já foi calculado em outro lugar. */
export function gerarNarrativaIA(entrada: EntradaNarrativaIA): string {
  const { decisoesPrioritarias, thesisMonitor, contagemAlertas, melhorOportunidade } = entrada;
  const frases: string[] = [];

  if (decisoesPrioritarias.length === 0) {
    frases.push("Hoje nenhuma ação é necessária — nenhuma tese quebrou, nenhum alerta crítico ou importante apareceu.");
  } else {
    const top = decisoesPrioritarias[0];
    frases.push(
      `A prioridade de hoje é ${top.empresa} (${top.ticker}): ${top.motivo.toLowerCase()}`
    );
    if (decisoesPrioritarias.length > 1) {
      const outros = decisoesPrioritarias.slice(1, 3).map((d) => d.ticker);
      frases.push(`Também merecem atenção: ${outros.join(", ")}${decisoesPrioritarias.length > 3 ? ` e mais ${decisoesPrioritarias.length - 3}` : ""}.`);
    }
  }

  if (contagemAlertas.critico > 0) {
    frases.push(`${contagemAlertas.critico} alerta${contagemAlertas.critico > 1 ? "s" : ""} crítico${contagemAlertas.critico > 1 ? "s" : ""} nas últimas 48h.`);
  }

  if (thesisMonitor.length > 0) {
    const fortalecendo = thesisMonitor.filter((t) => t.tendencia === "subindo");
    const enfraquecendo = thesisMonitor.filter((t) => t.tendencia === "descendo");
    if (fortalecendo.length > 0) {
      frases.push(`Nota subindo em ${fortalecendo.map((t) => t.ticker).join(", ")}.`);
    }
    if (enfraquecendo.length > 0) {
      frases.push(`Nota caindo em ${enfraquecendo.map((t) => t.ticker).join(", ")}.`);
    }
  }

  if (melhorOportunidade && melhorOportunidade.carry !== null) {
    frases.push(
      `No Radar, ${melhorOportunidade.ticker} segue como a candidata mais forte, com Carry IPCA+${(melhorOportunidade.carry * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%.`
    );
  }

  return frases.join(" ");
}
