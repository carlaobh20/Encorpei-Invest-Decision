import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import {
  GraficoBarras,
  TabelaSeries,
  rotuloTrimestre,
  CORES_COMPARADOR,
  type SerieBarras,
} from "@/components/GraficoBarras";
import { Zoom } from "@/components/Zoom";
import { ltmCampo, roicMedia4Tri } from "@/lib/fundamentos";
import { calcularScore } from "@/lib/score";
import { escadaCarry, type CarryResultado, type DegrauCarry } from "@/lib/carry";

export const dynamic = "force-dynamic";

/**
 * COMPARADOR v2 — ferramenta de decisão, não vitrine de números.
 * Regra: todo indicador exibido é CALCULÁVEL com dados oficiais que temos
 * (CVM + nº de ações oficial). O que não temos ainda (EBITDA, FCF,
 * dividendos, séries de 5-10 anos) está listado no rodapé com o que
 * destrava — nunca preenchido com invenção.
 */

type Fund = {
  ticker: string;
  competencia: string;
  fonte: string;
  receita_liquida: number | null;
  lucro_liquido: number | null;
  margem_bruta: number | null;
  margem_liquida: number | null;
  roic: number | null;
  divida_liquida: number | null;
  patrimonio_liquido: number | null;
};

type Empresa = { ticker: string; nome: string };

type Metrica = {
  bloco: string;
  nome: string;
  valores: (number | null)[];
  formato: "pct" | "reais" | "x" | "nota";
  melhor: "maior" | "menor";
  nota?: string;
};

const fmtMet = (v: number | null, formato: Metrica["formato"]): string => {
  if (v === null) return "—";
  if (formato === "pct")
    return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  if (formato === "x") return `${v.toFixed(1)}×`;
  if (formato === "nota") return v.toFixed(0);
  // reais compactos
  const abs = Math.abs(v);
  if (abs >= 1e9) return `R$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  if (abs >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mi`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

export default async function Comparar({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; c?: string }>;
}) {
  const sp = await searchParams;
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/comparar" titulo="Comparador">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const [{ data: empresasRaw }, { data: tesesRaw }] = await Promise.all([
    supabase.from("empresas").select("ticker, nome").eq("ativo", true).order("ticker"),
    supabase.from("teses").select("ticker").eq("ativa", true),
  ]);
  const empresas = (empresasRaw as Empresa[]) ?? [];
  const todosTickers = empresas.map((e) => e.ticker);
  const comTese = new Set((((tesesRaw as { ticker: string }[]) ?? [])).map((t) => t.ticker));

  const escolhidos = [sp.a, sp.b, sp.c]
    .map((t) => (t ?? "").toUpperCase())
    .filter((t) => todosTickers.includes(t));
  const unicos = [...new Set(escolhidos)].slice(0, 3);
  const padrao =
    unicos.length >= 2 ? unicos : ["WEGE3", "INTB3"].filter((t) => todosTickers.includes(t));

  let series: Record<string, SerieBarras[]> = {};
  let cards: {
    ticker: string; nome: string; cor: string;
    nota: number | null; notaOficial: boolean; confianca: string | null;
    carry: CarryResultado | null;
    escada: DegrauCarry[];
  }[] = [];
  let metricas: Metrica[] = [];
  let resumoExec: string[] = [];

  if (padrao.length >= 2) {
    const [{ data: fundsRaw }, { data: scoresRaw }, { data: precosRaw }, { data: acoesRaw }] =
      await Promise.all([
        supabase
          .from("fundamentos")
          .select("ticker, competencia, fonte, receita_liquida, lucro_liquido, margem_bruta, margem_liquida, roic, divida_liquida, patrimonio_liquido")
          .in("ticker", padrao)
          .order("competencia", { ascending: false }),
        supabase
          .from("scores")
          .select("ticker, data, qualidade, valuation, risco, score_final, confianca")
          .in("ticker", padrao)
          .order("data", { ascending: false })
          .limit(30),
        supabase
          .from("precos_diarios")
          .select("ticker, data, fechamento, market_cap")
          .in("ticker", padrao)
          .order("data", { ascending: false })
          .limit(30),
        supabase.from("acoes_totais").select("ticker, qtd_acoes").in("ticker", padrao),
      ]);

    const funds = (fundsRaw as Fund[]) ?? [];
    const porTicker = (t: string) => funds.filter((f) => f.ticker === t);
    const scoreDe = (t: string) =>
      ((scoresRaw as { ticker: string; qualidade: number | null; valuation: number | null; risco: number | null; score_final: number; confianca: string }[]) ?? [])
        .find((s) => s.ticker === t);
    const precoDe = (t: string) =>
      ((precosRaw as { ticker: string; fechamento: number; market_cap: number | null }[]) ?? [])
        .find((p) => p.ticker === t);
    const acoesDe = new Map(
      (((acoesRaw as { ticker: string; qtd_acoes: number }[]) ?? [])).map((a) => [a.ticker, Number(a.qtd_acoes)])
    );

    // ---------- métricas por empresa ----------
    const calc = padrao.map((t) => {
      const fs = porTicker(t);
      const rec = fs[0];
      const preco = precoDe(t);
      const ehUnit = t.endsWith("11");
      const qtd = acoesDe.get(t);
      const mcOficial = !ehUnit && qtd && preco?.fechamento ? qtd * Number(preco.fechamento) : null;
      const mc = mcOficial ?? (preco?.market_cap ? Number(preco.market_cap) : null);

      const lucroLtm = ltmCampo(fs, (f) => f.lucro_liquido);
      const receitaLtm = ltmCampo(fs, (f) => f.receita_liquida);
      const pl = rec?.patrimonio_liquido !== null && rec?.patrimonio_liquido !== undefined
        ? Number(rec.patrimonio_liquido) : null;

      // crescimento anual: DFP 2025 vs DFP 2024 (série CVM começa em 2024)
      const dfps = fs.filter((f) => f.fonte === "cvm_dfp").sort((a, b) => b.competencia.localeCompare(a.competencia));
      const cresc = (campo: (f: Fund) => number | null) => {
        if (dfps.length < 2) return null;
        const a = campo(dfps[0]);
        const b = campo(dfps[1]);
        if (a === null || b === null || Number(b) === 0) return null;
        if (Number(b) < 0) return null; // base negativa: taxa não faz sentido
        return Number(a) / Number(b) - 1;
      };

      const margensTri = fs
        .filter((f) => f.fonte === "cvm_itr" && f.margem_liquida !== null)
        .slice(0, 6)
        .map((f) => Number(f.margem_liquida));
      const desvio =
        margensTri.length >= 3
          ? Math.sqrt(
              margensTri.reduce((acc, m) => {
                const med = margensTri.reduce((x, y) => x + y, 0) / margensTri.length;
                return acc + (m - med) ** 2;
              }, 0) / margensTri.length
            )
          : null;

      const oficial = scoreDe(t);
      const previa = calcularScore({
        roic: rec?.roic != null ? Number(rec.roic) : null,
        margem_liquida: rec?.margem_liquida != null ? Number(rec.margem_liquida) : null,
        divida_liquida: rec?.divida_liquida != null ? Number(rec.divida_liquida) : null,
        patrimonio_liquido: pl,
        lucro_ltm: lucroLtm,
        market_cap: mc,
        margens_trimestrais: margensTri,
      });

      const roic4 = roicMedia4Tri(fs);
      const alav = rec?.divida_liquida != null && pl && pl > 0 ? Number(rec.divida_liquida) / pl : null;
      const ehFinanceira = (rec?.roic ?? null) === null && (rec?.divida_liquida ?? null) === null;
      const escada = escadaCarry({
        lucroLtm,
        marketCap: mc,
        roic4,
        margensDesvio: desvio,
        caixaLiquido: rec?.divida_liquida != null ? Number(rec.divida_liquida) <= 0 : null,
        alavancagem: alav,
        crescReceitaAnual: cresc((f) => (f.receita_liquida != null ? Number(f.receita_liquida) : null)),
        ehFinanceira,
        dividendosJcpLtm: null, // destrava com a migração 011 + sync da DFC
        caixaOperacionalLtm: null,
        capexLtm: null,
      });
      const carry = escada[0].resultado;

      return {
        ticker: t,
        carry,
        escada,
        roic4,
        roe: lucroLtm !== null && pl && pl > 0 ? lucroLtm / pl : null,
        margemBruta: rec?.margem_bruta != null ? Number(rec.margem_bruta) : null,
        margemLiq: rec?.margem_liquida != null ? Number(rec.margem_liquida) : null,
        desvio,
        divLiq: rec?.divida_liquida != null ? Number(rec.divida_liquida) : null,
        alav: rec?.divida_liquida != null && pl && pl > 0 ? Number(rec.divida_liquida) / pl : null,
        crescReceita: cresc((f) => (f.receita_liquida != null ? Number(f.receita_liquida) : null)),
        crescLucro: cresc((f) => (f.lucro_liquido != null ? Number(f.lucro_liquido) : null)),
        plRatio: lucroLtm !== null && lucroLtm > 0 && mc ? mc / lucroLtm : null,
        pvp: pl && pl > 0 && mc ? mc / pl : null,
        ey: lucroLtm !== null && mc && mc > 0 ? lucroLtm / mc : null,
        receitaLtm,
        qualidade: oficial?.qualidade ?? previa.qualidade,
        valuation: oficial?.valuation ?? previa.valuation,
        risco: oficial?.risco ?? previa.risco,
        notaFinal: oficial?.score_final ?? previa.score_final,
        notaOficial: !!oficial,
        confianca: oficial?.confianca ?? previa.confianca,
      };
    });

    cards = padrao.map((t, i) => {
      const c = calc[i];
      const e = empresas.find((x) => x.ticker === t);
      return {
        ticker: t,
        nome: e?.nome ?? t,
        cor: CORES_COMPARADOR[i],
        nota: c.notaFinal,
        notaOficial: c.notaOficial,
        confianca: c.confianca,
        carry: c.carry,
        escada: c.escada,
      };
    });

    const v = (pega: (c: (typeof calc)[number]) => number | null) => calc.map(pega);
    metricas = [
      { bloco: "Qualidade do negócio", nome: "ROIC (média 4 tri, pós-imposto)", valores: v((c) => c.roic4), formato: "pct", melhor: "maior" },
      { bloco: "Qualidade do negócio", nome: "ROE (lucro 12m ÷ patrimônio)", valores: v((c) => c.roe), formato: "pct", melhor: "maior" },
      { bloco: "Qualidade do negócio", nome: "Margem bruta", valores: v((c) => c.margemBruta), formato: "pct", melhor: "maior" },
      { bloco: "Qualidade do negócio", nome: "Margem líquida", valores: v((c) => c.margemLiq), formato: "pct", melhor: "maior" },
      { bloco: "Qualidade do negócio", nome: "Oscilação das margens (menor = mais previsível)", valores: v((c) => c.desvio), formato: "pct", melhor: "menor" },
      { bloco: "Solidez financeira", nome: "Dívida líquida (negativo = caixa)", valores: v((c) => c.divLiq), formato: "reais", melhor: "menor" },
      { bloco: "Solidez financeira", nome: "Dívida ÷ patrimônio", valores: v((c) => c.alav), formato: "pct", melhor: "menor" },
      { bloco: "Crescimento (2025 vs 2024)", nome: "Receita anual", valores: v((c) => c.crescReceita), formato: "pct", melhor: "maior" },
      { bloco: "Crescimento (2025 vs 2024)", nome: "Lucro anual", valores: v((c) => c.crescLucro), formato: "pct", melhor: "maior" },
      { bloco: "Valuation (preço atual)", nome: "Preço ÷ lucro 12m (menor = mais barata)", valores: v((c) => c.plRatio), formato: "x", melhor: "menor" },
      { bloco: "Valuation (preço atual)", nome: "Preço ÷ patrimônio", valores: v((c) => c.pvp), formato: "x", melhor: "menor" },
      { bloco: "Valuation (preço atual)", nome: "Rendimento do lucro (lucro ÷ preço)", valores: v((c) => c.ey), formato: "pct", melhor: "maior" },
      { bloco: "Nota Encorpei", nome: "Qualidade", valores: v((c) => c.qualidade), formato: "nota", melhor: "maior" },
      { bloco: "Nota Encorpei", nome: "Valuation", valores: v((c) => c.valuation), formato: "nota", melhor: "maior" },
      { bloco: "Nota Encorpei", nome: "Risco (maior = mais sólida)", valores: v((c) => c.risco), formato: "nota", melhor: "maior" },
      { bloco: "Nota Encorpei", nome: "Nota final", valores: v((c) => c.notaFinal), formato: "nota", melhor: "maior" },
    ];

    // ---------- resumo executivo POR REGRAS (IA nenhuma; template dos fatos) ----------
    const nomeDe = (i: number) => padrao[i];
    const idxMax = (xs: (number | null)[]) => {
      let bi = -1;
      xs.forEach((x, i) => { if (x !== null && (bi === -1 || x > (xs[bi] as number))) bi = i; });
      return bi;
    };
    const idxMin = (xs: (number | null)[]) => {
      let bi = -1;
      xs.forEach((x, i) => { if (x !== null && (bi === -1 || x < (xs[bi] as number))) bi = i; });
      return bi;
    };
    const iRoic = idxMax(v((c) => c.roic4));
    const iCresc = idxMax(v((c) => c.crescReceita));
    const iBarata = idxMin(v((c) => c.plRatio));
    const iNota = idxMax(v((c) => c.notaFinal));
    if (iRoic >= 0) resumoExec.push(`${nomeDe(iRoic)} tem o maior retorno sobre o capital do grupo.`);
    if (iCresc >= 0 && iCresc !== iRoic) resumoExec.push(`${nomeDe(iCresc)} cresceu mais em receita de 2024 para 2025.`);
    if (iBarata >= 0) resumoExec.push(`${nomeDe(iBarata)} está com o preço mais baixo em relação ao lucro (12 meses).`);
    if (iNota >= 0) resumoExec.push(`Pelas réguas versionadas do Encorpei, ${nomeDe(iNota)} tem a maior nota do grupo hoje.`);
    resumoExec.push("Gerado por regras a partir dos dados acima — não é recomendação de compra ou venda.");

    // ---------- gráficos trimestrais (mantidos) ----------
    const fundsItrAsc = funds.filter((f) => f.fonte === "cvm_itr").sort((a, b) => a.competencia.localeCompare(b.competencia));
    const competencias = [...new Set(fundsItrAsc.map((f) => f.competencia))].slice(-6);
    const serie = (campo: keyof Fund): SerieBarras[] =>
      padrao.map((t, i) => ({
        nome: t,
        cor: CORES_COMPARADOR[i],
        pontos: competencias.map((c) => {
          const f = fundsItrAsc.find((x) => x.ticker === t && x.competencia === c);
          const val = f?.[campo];
          return { rotulo: rotuloTrimestre(c), valor: val != null ? Number(val) : null };
        }),
      }));
    series = {
      receita: serie("receita_liquida"),
      margem: serie("margem_liquida"),
      roic: serie("roic"),
    };
  }

  return (
    <Shell
      ativo="/comparar"
      titulo="Comparador"
      subtitulo="Até 3 empresas lado a lado — mesmos dados oficiais, mesma régua, e o vencedor de cada métrica marcado. Todo indicador aqui responde uma pergunta de investidor de longo prazo."
      rolagem
    >
      {/* seleção */}
      <form method="GET" className="flex flex-wrap items-center gap-2 text-sm">
        {(["a", "b", "c"] as const).map((slot, i) => (
          <select
            key={slot}
            name={slot}
            defaultValue={padrao[i] ?? ""}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 focus:border-sky-400/50 focus:outline-none"
          >
            <option value="">{i === 2 ? "3ª (opcional)…" : `${i + 1}ª empresa…`}</option>
            {empresas.map((e) => (
              <option key={e.ticker} value={e.ticker}>
                {e.ticker}{comTese.has(e.ticker) ? " ●" : ""} — {e.nome}
              </option>
            ))}
          </select>
        ))}
        <button
          type="submit"
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-500"
        >
          Comparar
        </button>
        <span className="text-[10px] text-slate-600">● = tese ativa · agora dá para comparar qualquer uma das 40</span>
      </form>

      {padrao.length < 2 ? (
        <p className="text-slate-500">Escolha ao menos 2 empresas para comparar.</p>
      ) : (
        <>
          {/* cards de nota */}
          <div className={`grid gap-3 ${cards.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {cards.map((r) => (
              <div key={r.ticker} className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 font-mono text-lg font-bold">
                    <span className="h-3 w-3 rounded-sm" style={{ background: r.cor }} />
                    {r.ticker}
                  </span>
                  <span className="text-2xl font-bold text-emerald-300">{r.nota ?? "—"}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  {r.nome} · {r.notaOficial ? "nota oficial" : "prévia pelas réguas v1"} · confiança {r.confianca}
                </p>
              </div>
            ))}
          </div>

          {/* ============ ENCORPEI CARRY (destaque) ============ */}
          <section className="rounded-2xl border border-sky-400/20 bg-sky-500/[0.05] p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[11px] uppercase tracking-[0.25em] text-sky-300/90">
                Encorpei Carry Engine — a escada até o Retorno Intrínseco
              </h2>
              <span className="text-[10px] text-slate-500">v1 · piso conservador · determinístico</span>
            </div>
            <div className={`mt-3 grid gap-3 ${cards.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
              {cards.map((r) => (
                <div key={r.ticker} className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 font-mono font-bold">
                      <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.cor }} />
                      {r.ticker}
                    </span>
                    <span className="text-[10px] text-slate-500">confiança {r.carry?.confianca ?? "—"}</span>
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight text-sky-200">
                    {r.carry?.carryReal != null
                      ? `IPCA + ${(r.carry.carryReal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                      : "—"}
                    <span className="ml-1 text-xs font-normal text-slate-500">a.a.</span>
                  </p>
                  {/* a escada dos 5 níveis — cada um no seu estado real */}
                  <ul className="mt-2 space-y-1 border-t border-white/5 pt-2">
                    {r.escada.slice(1).map((d) => (
                      <li key={d.nivel} className="flex items-baseline justify-between gap-2 text-[10.5px]">
                        <span className="text-slate-500">{d.nome}</span>
                        {d.resultado?.carryReal != null ? (
                          <span className="shrink-0 font-mono font-semibold text-sky-200">
                            IPCA+{(d.resultado.carryReal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                          </span>
                        ) : (
                          <span className="shrink-0 text-slate-600" title={d.pendencia ?? ""}>
                            aguarda dados
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                  {r.carry && r.carry.fatores.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {r.carry.fatores.slice(0, 3).map((f, i) => (
                        <li key={i} className={`text-[11px] leading-snug ${
                          f.direcao === "sustenta" ? "text-emerald-300/80" : "text-amber-300/80"
                        }`}>
                          {f.direcao === "sustenta" ? "✔" : "•"} {f.texto}
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.carry?.carryReal == null && r.carry && (
                    <p className="mt-2 text-[11px] leading-snug text-slate-500">{r.carry.explicacao}</p>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-3 text-[10.5px] leading-snug text-slate-500">
              O número grande é o NÍVEL 1 (Carry Floor): lucro 12m ÷ valor de mercado — o pior
              cenário, empresa que nunca mais cresce. Os níveis 2-5 acendem conforme os dados
              oficiais chegam (o robô diário já coleta a DFC): Growth soma o reinvestimento
              (retenção × ROIC), Cash troca lucro contábil por geração de caixa, Allocation mede
              o que chega ao acionista, e o Retorno Intrínseco integra tudo — fórmulas abertas em
              docs/carry-engine.md do repositório. <span className="text-slate-400">Estimativas
              baseadas nos fundamentos atuais — NÃO é retorno garantido nem promessa de
              rentabilidade.</span>
            </p>
          </section>

          {/* placar por métrica */}
          <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
              Placar por métrica — quem vence e por quê
            </h2>
            <table className="mt-2 w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="py-1.5 pr-2">Indicador</th>
                  {cards.map((r) => (
                    <th key={r.ticker} className="py-1.5 pr-2 text-right font-mono">{r.ticker}</th>
                  ))}
                  <th className="py-1.5 text-right">Vence</th>
                </tr>
              </thead>
              <tbody>
                {metricas.map((m, mi) => {
                  const blocoNovo = mi === 0 || metricas[mi - 1].bloco !== m.bloco;
                  let melhorIdx = -1;
                  m.valores.forEach((x, i) => {
                    if (x === null) return;
                    if (melhorIdx === -1) melhorIdx = i;
                    else if (m.melhor === "maior" ? x > (m.valores[melhorIdx] as number) : x < (m.valores[melhorIdx] as number)) melhorIdx = i;
                  });
                  return (
                    <>
                      {blocoNovo && (
                        <tr key={`b-${m.bloco}`}>
                          <td colSpan={cards.length + 2} className="pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-300/70">
                            {m.bloco}
                          </td>
                        </tr>
                      )}
                      <tr key={m.nome} className="border-t border-white/5">
                        <td className="py-1.5 pr-2 text-slate-400">{m.nome}</td>
                        {m.valores.map((x, i) => (
                          <td
                            key={i}
                            className={`py-1.5 pr-2 text-right font-mono ${
                              i === melhorIdx ? "font-semibold text-slate-100" : "text-slate-400"
                            }`}
                          >
                            {fmtMet(x, m.formato)}
                          </td>
                        ))}
                        <td className="py-1.5 text-right">
                          {melhorIdx >= 0 ? (
                            <span
                              className="rounded-md px-2 py-0.5 font-mono text-[11px] font-semibold"
                              style={{ background: `${cards[melhorIdx].cor}22`, color: cards[melhorIdx].cor }}
                            >
                              {cards[melhorIdx].ticker}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>
                      </tr>
                    </>
                  );
                })}
              </tbody>
            </table>
          </section>

          {/* resumo executivo por regras */}
          <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Resumo executivo</h2>
            <div className="mt-2 space-y-1">
              {resumoExec.map((f, i) => (
                <p key={i} className={`text-[12.5px] leading-relaxed ${i === resumoExec.length - 1 ? "text-[10.5px] text-slate-600" : "text-slate-300"}`}>
                  {f}
                </p>
              ))}
            </div>
          </section>

          {/* gráficos trimestrais — clique para ampliar e ver os dados */}
          <div className="grid gap-3 lg:grid-cols-3">
            {(
              [
                ["Receita por trimestre", "reais", series.receita ?? []],
                ["Margem líquida", "percentual", series.margem ?? []],
                ["ROIC (pós-imposto)", "percentual", series.roic ?? []],
              ] as [string, "reais" | "percentual", SerieBarras[]][]
            ).map(([tituloG, formatoG, seriesG]) => (
              <Zoom
                key={tituloG}
                titulo={tituloG}
                ampliado={
                  <>
                    <GraficoBarras titulo={tituloG} formato={formatoG} altura={280} series={seriesG} />
                    <TabelaSeries series={seriesG} formato={formatoG} />
                  </>
                }
              >
                <GraficoBarras titulo={tituloG} formato={formatoG} altura={110} series={seriesG} />
              </Zoom>
            ))}
          </div>
          <p className="-mt-1 text-[10px] text-slate-600">
            clique em qualquer gráfico para ampliar e ver os números exatos
          </p>

          <p className="text-[10.5px] leading-snug text-slate-600">
            Fonte: demonstrativos oficiais da CVM + nº de ações oficial; valuation com preço de
            fechamento mais recente. Ainda NÃO comparamos (e não inventamos): EBITDA, fluxo de
            caixa livre, dividendos, cobertura de juros e séries de 5-10 anos — destravam com a
            leitura do DFC/dividendos no backfill da CVM e com o acúmulo de histórico (série
            oficial carregada começa em 2024). Financeiras (bancos/seguradoras): ROIC e dívida
            não se aplicam; compare por ROE, margem e valuation.
          </p>
        </>
      )}
    </Shell>
  );
}
