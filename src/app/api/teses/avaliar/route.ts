import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { calcularScore } from "@/lib/score";
import { calcularScorePorModelo } from "@/lib/score-setorial";
import { lucroLTM, ltmCampo, roicMedia4Tri } from "@/lib/fundamentos";
import { ehModeloFinanceiro, indicadorPermitido } from "@/lib/setores";
import { marketCapSelecionado } from "@/lib/marketcap";
import { escadaCarry, melhorDegrauCalculavel } from "@/lib/carry/escada";

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
      // Sector Intelligence: nunca deixa um gatilho de ROIC/dívida disparar
      // com dado que não faz sentido pro modelo do ticker (banco/seguradora)
      // — mesma trava do CI em setores.test.ts, aplicada aqui na leitura.
      m.divida_liquida = indicadorPermitido(tese.ticker, "divida_liquida")
        ? fund[0].divida_liquida
        : null;
      // ROIC: média dos últimos 4 trimestres (mata a sazonalidade que
      // gerou o falso alarme da Intelbras em 31/07/2026)
      m.roic = indicadorPermitido(tese.ticker, "roic")
        ? roicMedia4Tri(fund) ?? fund[0].roic
        : null;
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

  // ================= DECISION ENGINE =================
  // Depois dos gatilhos, calcula o score e o carry do dia de cada empresa
  // com tese. Regras puras (src/lib/score.ts / score-setorial.ts / carry/).
  //
  // "Fiação do motor" (03-04/08/2026): até aqui esta rota só usava o motor
  // genérico (calcularScore, sempre versao=1) e nunca escrevia em
  // carry_score — mesmo com Sector Intelligence e fluxo_caixa já em uso no
  // Radar/Comparador/Compounders havia dias. Não existe uma coluna
  // "vigente" em versao_algoritmo, então o interruptor aqui é literal: só
  // troca pro motor setorial (calcularScorePorModelo, versao_algoritmo=2)
  // se essa linha existir DE VERDADE no banco. Se não existir (ex.: ambiente
  // novo sem a migração 013 aplicada ainda), fica no v1 e registra isso na
  // resposta — nunca assume silenciosamente.
  const hojeSP = new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10);
  let scores_gravados = 0;
  let carry_gravados = 0;

  const { data: v2row, error: errV2 } = await supabase
    .from("versao_algoritmo")
    .select("versao")
    .eq("versao", 2)
    .limit(1);
  const usarScoreV2 = !errV2 && (v2row?.length ?? 0) > 0;
  if (!usarScoreV2) {
    console.warn(
      "[avaliar] versao_algoritmo=2 não encontrada no banco — mantendo motor genérico v1. " +
        (errV2 ? `Erro: ${errV2.message}` : "Migração 013 parece ausente.")
    );
  }

  for (const tese of teses ?? []) {
    const { data: funds } = await supabase
      .from("fundamentos")
      .select("competencia, fonte, receita_liquida, roic, margem_liquida, divida_liquida, patrimonio_liquido, lucro_liquido")
      .eq("ticker", tese.ticker)
      .order("competencia", { ascending: false });
    if (!funds || funds.length === 0) continue;

    const maisRecente = funds[0];

    // lucro dos últimos 12 meses — regra compartilhada (lib/fundamentos)
    const lucro_ltm = lucroLTM(funds);

    // Valor de mercado: fonte OFICIAL primeiro (nº de ações da CVM ×
    // fechamento). A auditoria de 01/08/2026 pegou a brapi informando
    // market_cap errado para MULT3 (metade do real) e EGIE3 (~25% a mais);
    // brapi agora é apenas fallback quando não temos o nº de ações.
    const [{ data: acoes }, { data: precoRec }, { data: precoMc }, { data: fluxoRaw, error: errFluxo }] =
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
        // fluxo_caixa (migração 011) — alimenta o Carry Growth/Cash. Se a
        // tabela ainda não existir num ambiente novo, vem erro aqui e os
        // 3 campos LTM abaixo ficam null (nunca inventados); o carry cai
        // pro degrau Floor, que não depende de DFC.
        supabase
          .from("fluxo_caixa")
          .select("competencia, fonte, caixa_operacional, capex, dividendos_jcp")
          .eq("ticker", tese.ticker)
          .order("competencia", { ascending: false }),
      ]);
    if (errFluxo) {
      console.warn(
        `[avaliar] fluxo_caixa indisponível para ${tese.ticker} (migração 011 pendente?): ${errFluxo.message}`
      );
    }
    const fluxo = fluxoRaw ?? [];
    const qtdAcoes = acoes?.[0]?.qtd_acoes ? Number(acoes[0].qtd_acoes) : null;
    const fechRec = precoRec?.[0]?.fechamento
      ? Number(precoRec[0].fechamento)
      : null;
    // Guardrail: tickers "11" são units (pacotes de várias ações — ex.:
    // KLBN11 = 5 papéis), então preço da unit × total de ações NÃO é o
    // valor de mercado. Para elas, só o fallback da brapi serve.
    const ehUnit = tese.ticker.endsWith("11");
    // auditoria de 03/08/2026: acoes_totais (CVM) pode estar desatualizado
    // (ex.: desdobramento ainda não refilado) — quando isso diverge muito
    // do market_cap AO VIVO que a própria brapi reporta, confia no dado ao
    // vivo em vez do calculado a partir de uma contagem de ações velha.
    // Ver src/lib/marketcap.ts (mesma correção usada no Radar/Comparador).
    const marketCap = marketCapSelecionado({
      qtdAcoes,
      fechamento: fechRec,
      marketCapMercado: precoMc?.[0]?.market_cap ? Number(precoMc[0].market_cap) : null,
      ehUnit,
    }).valor;

    const margensTri = funds
      .filter((f) => f.fonte === "cvm_itr" && f.margem_liquida !== null)
      .slice(0, 6)
      .map((f) => Number(f.margem_liquida));

    const patrimonioNum =
      maisRecente.patrimonio_liquido !== null ? Number(maisRecente.patrimonio_liquido) : null;
    const roicNum =
      indicadorPermitido(tese.ticker, "roic") && maisRecente.roic !== null
        ? Number(maisRecente.roic)
        : null;
    const margemNum =
      maisRecente.margem_liquida !== null ? Number(maisRecente.margem_liquida) : null;
    const dividaNum =
      indicadorPermitido(tese.ticker, "divida_liquida") && maisRecente.divida_liquida !== null
        ? Number(maisRecente.divida_liquida)
        : null;
    // ROE (12m ÷ patrimônio) — só entra na régua setorial (v2) de
    // financeiras, que usa ROE no lugar de ROIC (não faz sentido pra banco).
    const roeNum =
      lucro_ltm !== null && patrimonioNum !== null && patrimonioNum > 0
        ? lucro_ltm / patrimonioNum
        : null;

    // Sector Intelligence (auditoria de 03/08/2026): ROIC e dívida líquida
    // não existem no sentido industrial para banco/seguradora — sem este
    // gate, o SCORE OFICIAL (gravado, imutável) de BBDC4/BBAS3/BBSE3/CXSE3
    // ficava contaminado por "dívida"/"ROIC" que não fazem sentido para o
    // modelo, sempre que o filing da CVM populava esses campos por acaso.
    // Motor: v2 (calcularScorePorModelo, réguas por modelo de negócio)
    // quando versao_algoritmo=2 existe no banco; senão v1 (calcularScore),
    // igual ao comportamento anterior à fiação de hoje.
    const resultado = usarScoreV2
      ? calcularScorePorModelo(tese.ticker, {
          roic: roicNum,
          roe: roeNum,
          margem_liquida: margemNum,
          divida_liquida: dividaNum,
          patrimonio_liquido: patrimonioNum,
          lucro_ltm,
          market_cap: marketCap,
          margens_trimestrais: margensTri,
        })
      : calcularScore({
          roic: roicNum,
          margem_liquida: margemNum,
          divida_liquida: dividaNum,
          patrimonio_liquido: patrimonioNum,
          lucro_ltm,
          market_cap: marketCap,
          margens_trimestrais: margensTri,
        });

    // histórico imutável: primeiro cálculo do dia prevalece
    const { error: errScore } = await supabase.from("scores").insert({
      ticker: tese.ticker,
      data: hojeSP,
      versao: usarScoreV2 ? 2 : 1,
      qualidade: resultado.qualidade,
      valuation: resultado.valuation,
      risco: resultado.risco,
      score_final: resultado.score_final,
      confianca: resultado.confianca,
      decomposicao: resultado.decomposicao,
    });
    if (!errScore) scores_gravados++;

    // ---------- Carry (novo: grava carry_score diário) ----------
    // Mesmos insumos que Radar/Comparador já montam pra tela — aqui viram
    // histórico oficial imutável, um por dia por empresa com tese.
    const roic4 = indicadorPermitido(tese.ticker, "roic") ? roicMedia4Tri(funds) : null;
    const caixaLiquido =
      indicadorPermitido(tese.ticker, "divida_liquida") && dividaNum !== null
        ? dividaNum <= 0
        : null;
    const alavancagem =
      dividaNum !== null && patrimonioNum !== null && patrimonioNum > 0
        ? dividaNum / patrimonioNum
        : null;
    const dfps = funds
      .filter((f) => f.fonte === "cvm_dfp")
      .sort((a, b) => b.competencia.localeCompare(a.competencia));
    const crescReceitaAnual =
      dfps.length >= 2 &&
      dfps[0].receita_liquida !== null &&
      dfps[1].receita_liquida !== null &&
      Number(dfps[1].receita_liquida) > 0
        ? Number(dfps[0].receita_liquida) / Number(dfps[1].receita_liquida) - 1
        : null;
    const margensDesvio =
      margensTri.length >= 3
        ? Math.sqrt(
            margensTri.reduce((acc, mv) => {
              const med = margensTri.reduce((x, y) => x + y, 0) / margensTri.length;
              return acc + (mv - med) ** 2;
            }, 0) / margensTri.length
          )
        : null;
    const ehFinanceira = ehModeloFinanceiro(tese.ticker);
    // DFC ITR é acumulada no ano — ltmCampo já implementa a regra oficial
    // (12m = DFP + acumulado atual − acumulado equivalente do ano anterior),
    // mesma função usada em comparar/page.tsx e compounder-dados.ts.
    const dividendosJcpLtm = fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.dividendos_jcp) : null;
    const caixaOperacionalLtm =
      fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.caixa_operacional) : null;
    const capexLtm = fluxo.length > 0 ? ltmCampo(fluxo, (f) => f.capex) : null;

    const degraus = escadaCarry({
      lucroLtm: lucro_ltm,
      marketCap,
      roic4,
      margensDesvio,
      caixaLiquido,
      alavancagem,
      crescReceitaAnual,
      ehFinanceira,
      dividendosJcpLtm,
      caixaOperacionalLtm,
      capexLtm,
    });
    // usa o degrau mais alto já calculável (Cash > Growth > Floor) — o
    // Floor sempre tem "resultado" preenchido (mesmo com carryReal null e
    // explicação de pendência), então sempre sobra pelo menos ele.
    // Regra extraída para src/lib/carry/escada.ts (Foundation v3 — Módulo 8).
    const melhorDegrau = melhorDegrauCalculavel(degraus);
    if (melhorDegrau.resultado) {
      const { error: errCarry } = await supabase.from("carry_score").insert({
        ticker: tese.ticker,
        data: hojeSP,
        versao: melhorDegrau.resultado.versao,
        metodo: melhorDegrau.resultado.metodo,
        carry_real: melhorDegrau.resultado.carryReal,
        confianca: melhorDegrau.resultado.confianca,
        explicacao: melhorDegrau.resultado.explicacao,
        fatores: melhorDegrau.resultado.fatores,
      });
      if (!errCarry) carry_gravados++;
    }
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
    carry_gravados,
    versao_algoritmo_usada: usarScoreV2 ? 2 : 1,
    alerta_email,
    executado_em: new Date().toISOString(),
  });
}
