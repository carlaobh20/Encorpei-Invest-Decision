import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { calcularScore } from "@/lib/score";

/**
 * MOTOR DE GATILHOS — coração da Tese Viva.
 *
 * Roda todo dia útil (cron da Vercel) depois da coleta de preços.
 * Fundação: quem decide são REGRAS versionadas no banco; cada disparo
 * gera um evento imutável com os dados exatos que o causaram.
 *
 * Disparo manual: GET com header Authorization: Bearer <CRON_SECRET>
 */
export const maxDuration = 60;
export const dynamic = "force-dynamic";

type Metricas = Record<string, number | null>;

function avaliar(op: string, atual: number, limite: number): boolean {
  if (op === "<") return atual < limite;
  if (op === ">") return atual > limite;
  if (op === "<=") return atual <= limite;
  return atual >= limite;
}

export async function GET(req: NextRequest) {
  // SÓ header — secret em URL vaza em logs (revisão de segurança 01/08)
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ erro: "não autorizado" }, { status: 401 });
  }
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ erro: "Supabase não configurado" }, { status: 500 });
  }

  const { data: teses, error } = await supabase
    .from("teses")
    .select("id, ticker, status, gatilhos(id, descricao, metrica, operador, valor, direcao, ativo)")
    .eq("ativa", true);
  if (error) return NextResponse.json({ erro: error.message }, { status: 500 });

  const disparos: object[] = [];

  for (const tese of teses ?? []) {
    // ---- métricas atuais do ticker ----
    const m: Metricas = {
      roic: null, margem_liquida: null, divida_liquida: null, queda_preco_30d: null,
    };

    const { data: fund } = await supabase
      .from("fundamentos")
      .select("competencia, fonte, roic, margem_liquida, divida_liquida")
      .eq("ticker", tese.ticker)
      .order("competencia", { ascending: false })
      .limit(6);
    if (fund?.[0]) {
      // margem e dívida: retrato mais recente
      m.margem_liquida = fund[0].margem_liquida;
      m.divida_liquida = fund[0].divida_liquida;
      // ROIC: média dos últimos 4 trimestres (mata a sazonalidade que
      // gerou o falso alarme da Intelbras em 31/07/2026)
      const roicsTri = fund
        .filter((f) => f.fonte === "cvm_itr" && f.roic !== null)
        .slice(0, 4)
        .map((f) => Number(f.roic));
      m.roic = roicsTri.length
        ? roicsTri.reduce((a, b) => a + b, 0) / roicsTri.length
        : fund[0].roic;
    }

    const desde = new Date(Date.now() - 30 * 86_400_000)
      .toISOString().slice(0, 10);
    const { data: precos } = await supabase
      .from("precos_diarios")
      .select("data, fechamento")
      .eq("ticker", tese.ticker)
      .gte("data", desde)
      .order("data", { ascending: true });
    if (precos && precos.length >= 5) {
      const max = Math.max(...precos.map((p) => Number(p.fechamento)));
      const ultimo = Number(precos[precos.length - 1].fechamento);
      if (max > 0) m.queda_preco_30d = (max - ultimo) / max;
    }

    // ---- avaliar cada gatilho ----
    for (const g of tese.gatilhos ?? []) {
      if (!g.ativo) continue;
      const atual = m[g.metrica];
      if (atual === null || atual === undefined) continue; // sem dado, sem disparo

      if (avaliar(g.operador, Number(atual), Number(g.valor))) {
        // dedupe: não repetir o mesmo disparo em menos de 20h
        const desde20h = new Date(Date.now() - 20 * 3_600_000).toISOString();
        const { data: recentes } = await supabase
          .from("eventos_tese")
          .select("id")
          .eq("gatilho_id", g.id)
          .eq("tipo", "gatilho_disparado")
          .gte("criado_em", desde20h)
          .limit(1);
        if (recentes && recentes.length > 0) continue;

        const explicacao =
          `Gatilho ${g.direcao === "negativo" ? "NEGATIVO" : "POSITIVO"} disparado: ` +
          `${g.descricao}. Valor atual de ${g.metrica} = ${Number(atual).toFixed(4)}, ` +
          `condição: ${g.metrica} ${g.operador} ${g.valor}. ` +
          (g.direcao === "negativo"
            ? "A tese entra em revisão: verifique se a premissa continua de pé antes de qualquer decisão."
            : "Possível oportunidade SE os fundamentos seguirem intactos — confira os demais gatilhos antes.");

        await supabase.from("eventos_tese").insert({
          tese_id: tese.id,
          gatilho_id: g.id,
          tipo: "gatilho_disparado",
          detalhe: {
            metrica: g.metrica, valor_atual: atual,
            operador: g.operador, limite: g.valor, direcao: g.direcao,
          },
          explicacao,
        });
        disparos.push({ ticker: tese.ticker, gatilho: g.descricao, valor_atual: atual });

        if (g.direcao === "negativo" && tese.status === "valida") {
          await supabase.from("teses").update({ status: "em_revisao" }).eq("id", tese.id);
          await supabase.from("eventos_tese").insert({
            tese_id: tese.id,
            tipo: "mudanca_status",
            detalhe: { de: "valida", para: "em_revisao", causa: g.descricao },
            explicacao: `Status alterado de VÁLIDA para EM REVISÃO por causa do gatilho: ${g.descricao}.`,
          });
          tese.status = "em_revisao";
        }
      }
    }
  }

  // ================= DECISION ENGINE v1 =================
  // Depois dos gatilhos, calcula o score do dia de cada empresa com tese.
  // Regras puras (src/lib/score.ts) espelhando versao_algoritmo = 1.
  const hojeSP = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  let scores_gravados = 0;

  for (const tese of teses ?? []) {
    const { data: funds } = await supabase
      .from("fundamentos")
      .select("competencia, fonte, roic, margem_liquida, divida_liquida, patrimonio_liquido, lucro_liquido")
      .eq("ticker", tese.ticker)
      .order("competencia", { ascending: false });
    if (!funds || funds.length === 0) continue;

    const maisRecente = funds[0];

    // lucro dos últimos 12 meses: último anual (DFP) + trimestres
    // posteriores (ITR) - trimestres equivalentes do ano anterior
    let lucro_ltm: number | null = null;
    const dfp = funds.find((f) => f.fonte === "cvm_dfp");
    if (dfp?.lucro_liquido !== null && dfp?.lucro_liquido !== undefined) {
      lucro_ltm = Number(dfp.lucro_liquido);
      const posteriores = funds.filter(
        (f) => f.fonte === "cvm_itr" && f.competencia > dfp.competencia
      );
      for (const p of posteriores) {
        const anoAnterior = `${Number(p.competencia.slice(0, 4)) - 1}${p.competencia.slice(4)}`;
        const equivalente = funds.find(
          (f) => f.fonte === "cvm_itr" && f.competencia === anoAnterior
        );
        if (p.lucro_liquido === null || !equivalente || equivalente.lucro_liquido === null) {
          lucro_ltm = null;
          break;
        }
        lucro_ltm += Number(p.lucro_liquido) - Number(equivalente.lucro_liquido);
      }
    }

    // Valor de mercado: fonte OFICIAL primeiro (nº de ações da CVM ×
    // fechamento). A auditoria de 01/08/2026 pegou a brapi informando
    // market_cap errado para MULT3 (metade do real) e EGIE3 (~25% a mais);
    // brapi agora é apenas fallback quando não temos o nº de ações.
    const [{ data: acoes }, { data: precoRec }, { data: precoMc }] =
      await Promise.all([
        supabase
          .from("acoes_totais")
          .select("qtd_acoes")
          .eq("ticker", tese.ticker)
          .limit(1),
        supabase
          .from("precos_diarios")
          .select("fechamento")
          .eq("ticker", tese.ticker)
          .order("data", { ascending: false })
          .limit(1),
        supabase
          .from("precos_diarios")
          .select("market_cap")
          .eq("ticker", tese.ticker)
          .not("market_cap", "is", null)
          .order("data", { ascending: false })
          .limit(1),
      ]);
    const qtdAcoes = acoes?.[0]?.qtd_acoes ? Number(acoes[0].qtd_acoes) : null;
    const fechRec = precoRec?.[0]?.fechamento
      ? Number(precoRec[0].fechamento)
      : null;
    const mcOficial = qtdAcoes && fechRec ? qtdAcoes * fechRec : null;

    const margensTri = funds
      .filter((f) => f.fonte === "cvm_itr" && f.margem_liquida !== null)
      .slice(0, 6)
      .map((f) => Number(f.margem_liquida));

    const resultado = calcularScore({
      roic: maisRecente.roic !== null ? Number(maisRecente.roic) : null,
      margem_liquida:
        maisRecente.margem_liquida !== null ? Number(maisRecente.margem_liquida) : null,
      divida_liquida:
        maisRecente.divida_liquida !== null ? Number(maisRecente.divida_liquida) : null,
      patrimonio_liquido:
        maisRecente.patrimonio_liquido !== null
          ? Number(maisRecente.patrimonio_liquido)
          : null,
      lucro_ltm,
      market_cap:
        mcOficial ??
        (precoMc?.[0]?.market_cap ? Number(precoMc[0].market_cap) : null),
      margens_trimestrais: margensTri,
    });

    // histórico imutável: primeiro cálculo do dia prevalece
    const { error: errScore } = await supabase.from("scores").insert({
      ticker: tese.ticker,
      data: hojeSP,
      versao: 1,
      qualidade: resultado.qualidade,
      valuation: resultado.valuation,
      risco: resultado.risco,
      score_final: resultado.score_final,
      confianca: resultado.confianca,
      decomposicao: resultado.decomposicao,
    });
    if (!errScore) scores_gravados++;
  }

  // ---------- ALERTA POR E-MAIL (ativa quando RESEND_API_KEY existir) ----------
  let alerta_email = "desativado (sem RESEND_API_KEY/ALERT_EMAIL)";
  const resendKey = process.env.RESEND_API_KEY;
  const alertEmail = process.env.ALERT_EMAIL;
  if (disparos.length > 0 && resendKey && alertEmail) {
    try {
      const itens = (disparos as { ticker: string; gatilho: string; valor_atual: number }[])
        .map((d) => `<li><b>${d.ticker}</b>: ${d.gatilho} (valor atual: ${d.valor_atual})</li>`)
        .join("");
      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "Encorpei Invest <onboarding@resend.dev>",
          to: [alertEmail],
          subject: `Encorpei: ${disparos.length} gatilho(s) dispararam hoje`,
          html:
            `<p>O motor diário detectou mudanças que pedem sua atenção:</p><ul>${itens}</ul>` +
            `<p><a href="https://encorpei-invest-decision.vercel.app/replay">Ver a linha do tempo completa →</a></p>` +
            `<p style="color:#888;font-size:12px">Sistema pessoal de apoio à decisão. Não é recomendação de investimento.</p>`,
        }),
      });
      alerta_email = resp.ok ? "enviado" : `falhou (HTTP ${resp.status})`;
    } catch (e) {
      alerta_email = `falhou (${String(e)})`;
    }
  } else if (disparos.length === 0) {
    alerta_email = "sem disparos, sem e-mail";
  }

  return NextResponse.json({
    teses_avaliadas: teses?.length ?? 0,
    disparos,
    scores_gravados,
    alerta_email,
    executado_em: new Date().toISOString(),
  });
}
