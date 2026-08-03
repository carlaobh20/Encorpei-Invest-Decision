/**
 * DECISION HISTORY — PIC 01 (03/08/2026).
 *
 * O Diário (`decisoes`, migração 007) já registra TUDO que a spec pediu:
 * data, empresa, motivo (justificativa) e a FOTO do que o sistema dizia no
 * momento (score, status da tese, preço) — imutável desde o dia 1 (regra
 * de fundação #2). A única peça que faltava é "resultado posterior:
 * acertou/errou" — este módulo.
 *
 * Cuidado deliberado: isto julga se o PREÇO se moveu na direção que a
 * decisão sugeria — nunca se "a decisão foi boa". Preço de curto prazo é
 * ruído; comprar uma ótima empresa pode "errar" 3 meses e acertar 3 anos.
 * O rótulo e o texto deixam isso explícito, sempre. "Mantive"/"observei"
 * nunca recebem julgamento (não há direção implícita nessas duas).
 */

export type DecisaoTipo = "comprei" | "vendi" | "aumentei" | "reduzi" | "mantive" | "observei";
export type Julgamento = "a_favor" | "contra" | "neutro" | "indisponivel";

export const ROTULO_JULGAMENTO: Record<Julgamento, string> = {
  a_favor: "Preço a favor",
  contra: "Preço contra",
  neutro: "Neutro",
  indisponivel: "Sem preço para comparar",
};

const DIRECAO_ALTA: DecisaoTipo[] = ["comprei", "aumentei"];
const DIRECAO_BAIXA: DecisaoTipo[] = ["vendi", "reduzi"];

export type DecisaoEntrada = {
  id: number;
  ticker: string;
  decisao: DecisaoTipo;
  justificativa: string;
  criadoEm: string; // ISO
  precoNaDecisao: number | null;
};

export type DecisaoAvaliada = DecisaoEntrada & {
  precoAtual: number | null;
  variacaoPct: number | null;
  diasDecorridos: number;
  julgamento: Julgamento;
  explicacaoJulgamento: string;
  confiavel: boolean; // false quando passou pouco tempo — julgamento ainda é ruído
};

function diffDias(desde: string, ate: string): number {
  const a = new Date(desde).getTime();
  const b = new Date(ate).getTime();
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** `agora` é injetado (não `new Date()` interno) — mantém a função pura e testável. */
export function avaliarDecisoes(
  decisoes: DecisaoEntrada[],
  precoAtualPorTicker: Map<string, number>,
  agora: string
): DecisaoAvaliada[] {
  return decisoes.map((d) => {
    const precoAtual = precoAtualPorTicker.get(d.ticker) ?? null;
    const diasDecorridos = diffDias(d.criadoEm, agora);
    const confiavel = diasDecorridos >= 30;

    if (d.precoNaDecisao === null || precoAtual === null) {
      return {
        ...d,
        precoAtual,
        variacaoPct: null,
        diasDecorridos,
        julgamento: "indisponivel",
        explicacaoJulgamento: "Sem preço registrado no momento da decisão ou sem preço atual — não dá pra comparar.",
        confiavel,
      };
    }

    const variacaoPct = d.precoNaDecisao > 0 ? precoAtual / d.precoNaDecisao - 1 : null;
    if (variacaoPct === null) {
      return {
        ...d,
        precoAtual,
        variacaoPct: null,
        diasDecorridos,
        julgamento: "indisponivel",
        explicacaoJulgamento: "Preço na decisão inválido — não dá pra calcular variação.",
        confiavel,
      };
    }

    const sinal = variacaoPct > 0.001 ? 1 : variacaoPct < -0.001 ? -1 : 0;
    let julgamento: Julgamento = "neutro";
    if (DIRECAO_ALTA.includes(d.decisao)) {
      julgamento = sinal > 0 ? "a_favor" : sinal < 0 ? "contra" : "neutro";
    } else if (DIRECAO_BAIXA.includes(d.decisao)) {
      julgamento = sinal < 0 ? "a_favor" : sinal > 0 ? "contra" : "neutro";
    } else {
      julgamento = "neutro"; // mantive/observei: sem direção implícita, nunca julga
    }

    const variacaoTxt = `${variacaoPct >= 0 ? "+" : ""}${(variacaoPct * 100).toFixed(1)}%`;
    const baseExplicacao =
      DIRECAO_ALTA.includes(d.decisao) || DIRECAO_BAIXA.includes(d.decisao)
        ? `Preço variou ${variacaoTxt} desde a decisão (${diasDecorridos} dias) — julgamento é sobre o PREÇO, não sobre se a tese continua boa.`
        : `Preço variou ${variacaoTxt} desde o registro (${diasDecorridos} dias) — informativo, "${d.decisao}" não tem direção implícita pra julgar.`;

    return {
      ...d,
      precoAtual,
      variacaoPct,
      diasDecorridos,
      julgamento,
      explicacaoJulgamento: confiavel
        ? baseExplicacao
        : `${baseExplicacao} Menos de 30 dias — ainda é cedo, ruído de curto prazo pesa mais que sinal.`,
      confiavel,
    };
  });
}
