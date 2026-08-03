import { revalidatePath } from "next/cache";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { Shell } from "@/components/Shell";
import { consolidarCarteira, notaPonderada, type Posicao } from "@/lib/carteira";
import { ROTULO_MODELO } from "@/lib/setores";
import { AcoesPosicao } from "@/components/AcoesPosicao";

export const dynamic = "force-dynamic";

/**
 * CARTEIRA — posições REAIS registradas pelo dono. É o que destrava o
 * Decision Center de verdade: patrimônio, resultado e alocação derivados de
 * dados registrados, nunca inventados. Sharpe/alpha/benchmark ficam gateados
 * até existir série de patrimônio acumulada. Nada aqui é recomendação.
 */

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null, casas = 1) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;

async function salvarPosicao(formData: FormData) {
  "use server";
  const ticker = String(formData.get("ticker") ?? "").toUpperCase();
  const quantidade = Number(formData.get("quantidade") ?? 0);
  const precoMedio = Number(String(formData.get("preco_medio") ?? "0").replace(",", "."));
  const dataCompraRaw = String(formData.get("data_compra") ?? "").trim();
  const dataCompra = dataCompraRaw.length > 0 ? dataCompraRaw : null;

  // Chave/PIN removida em 03/08/2026 (mesma decisão do Diário): a proteção
  // real é o Vercel Authentication (SSO), já ativo no domínio inteiro —
  // bloqueia qualquer acesso de quem não é membro do time na Vercel. Uma
  // segunda trava aqui era redundante para um app de usuário único.
  const { usuarioLogado } = await import("@/lib/supabase-auth");
  const user = await usuarioLogado();
  if (!ticker || !Number.isFinite(quantidade) || quantidade < 0) return;

  const admin = getSupabaseAdmin();
  if (!admin) return;

  if (quantidade === 0) {
    // quantidade 0 = posição encerrada → remove do ESTADO atual.
    // (o registro histórico da decisão continua sendo papel do Diário)
    let q = admin.from("posicoes").delete().eq("ticker", ticker);
    q = user ? q.eq("user_id", user.id) : q.is("user_id", null);
    await q;
  } else {
    if (!Number.isFinite(precoMedio) || precoMedio <= 0) return;
    await admin.from("posicoes").upsert(
      {
        ticker,
        quantidade,
        preco_medio: precoMedio,
        data_compra: dataCompra,
        user_id: user?.id ?? null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "ticker,user_id" }
    );
  }
  revalidatePath("/carteira");
  revalidatePath("/");
}

export default async function Carteira() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/carteira" titulo="Carteira">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const { data: posicoesRaw, error: erroPosicoes } = await supabase
    .from("posicoes")
    .select("ticker, quantidade, preco_medio, data_compra")
    .order("ticker");

  // Guarda: migração 014 ainda não aplicada → avisar, nunca quebrar.
  if (erroPosicoes) {
    return (
      <Shell ativo="/carteira" titulo="Carteira">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5 text-sm text-amber-200">
          <p className="font-semibold">Módulo pronto, banco ainda não.</p>
          <p className="mt-1 text-amber-200/80">
            A tabela de posições (migração 014_carteira) ainda não foi aplicada
            no Supabase. Assim que for, esta página passa a funcionar sem
            nenhuma outra mudança.
          </p>
        </div>
      </Shell>
    );
  }

  const posicoes = (posicoesRaw as Posicao[]) ?? [];

  const [{ data: empresasRaw }, { data: precosRaw }, { data: scoresRaw }, { data: tesesRaw }] =
    await Promise.all([
      supabase.from("empresas").select("ticker, nome").eq("ativo", true).order("ticker"),
      supabase
        .from("precos_diarios")
        .select("ticker, data, fechamento")
        .order("data", { ascending: false })
        .limit(300),
      supabase
        .from("scores")
        .select("ticker, score_final, data")
        .order("data", { ascending: false })
        .limit(200),
      supabase.from("teses").select("ticker, status").eq("ativa", true),
    ]);

  const empresas = (empresasRaw as { ticker: string; nome: string }[]) ?? [];
  const precoPorTicker = new Map<string, number>();
  const dataPrecoPorTicker = new Map<string, string>();
  for (const p of (precosRaw as { ticker: string; data: string; fechamento: number }[]) ?? []) {
    if (!precoPorTicker.has(p.ticker)) {
      precoPorTicker.set(p.ticker, Number(p.fechamento));
      dataPrecoPorTicker.set(p.ticker, p.data);
    }
  }
  const notaPorTicker = new Map<string, number>();
  for (const s of (scoresRaw as { ticker: string; score_final: number }[]) ?? []) {
    if (!notaPorTicker.has(s.ticker)) notaPorTicker.set(s.ticker, Number(s.score_final));
  }
  const statusTese = new Map(
    (((tesesRaw as { ticker: string; status: string }[]) ?? [])).map((t) => [t.ticker, t.status])
  );

  const c = consolidarCarteira(posicoes, precoPorTicker);
  const nota = notaPonderada(c.linhas, notaPorTicker);
  const corResultado = (v: number | null) =>
    v === null ? "text-slate-500" : v >= 0 ? "text-emerald-300" : "text-red-300";

  return (
    <Shell
      ativo="/carteira"
      titulo="Carteira"
      subtitulo="Suas posições reais, avaliadas com preço oficial mais recente. Estado atual editável — o registro imutável de cada decisão continua no Diário."
      rolagem
    >
      {/* ---------- totais ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Investido</p>
          <p className="mt-1 text-lg font-bold">{brl(c.valorInvestido)}</p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Valor atual</p>
          <p className="mt-1 text-lg font-bold">
            {c.valorAtual !== null ? brl(c.valorAtual) : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">Resultado</p>
          <p className={`mt-1 text-lg font-bold ${corResultado(c.resultado)}`}>
            {c.resultado !== null ? `${brl(c.resultado)} (${pct(c.resultadoPct)})` : "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-white/5 bg-white/[0.03] px-4 py-3">
          <p className="text-[10px] uppercase tracking-[0.25em] text-slate-500">
            Nota média (ponderada)
          </p>
          <p className="mt-1 text-lg font-bold text-sky-300">
            {nota !== null ? Math.round(nota) : "—"}
          </p>
          {nota === null && posicoes.length > 0 && (
            <p className="text-[10px] text-slate-600">só com nota oficial de TODAS as posições</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* ---------- registrar posição ---------- */}
        <section className="col-span-12 rounded-2xl border border-white/5 bg-white/[0.03] p-5 lg:col-span-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            Registrar / atualizar posição
          </h2>
          <form id="form-posicao" action={salvarPosicao} className="mt-3 space-y-3 text-sm">
            <select
              id="f-ticker"
              name="ticker"
              required
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 focus:border-sky-400/50 focus:outline-none"
            >
              <option value="">Empresa…</option>
              {empresas.map((e) => (
                <option key={e.ticker} value={e.ticker}>
                  {e.ticker} — {e.nome}
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input
                id="f-quantidade"
                type="number"
                name="quantidade"
                required
                min={0}
                step="any"
                placeholder="Quantidade"
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
              />
              <input
                id="f-preco"
                type="text"
                name="preco_medio"
                inputMode="decimal"
                placeholder="Preço médio (R$)"
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
              />
            </div>
            <div>
              <input
                id="f-data"
                type="date"
                name="data_compra"
                max={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
              />
              <p className="mt-1 text-[10px] text-slate-600">
                Desde quando (opcional) — sem isso, a comparação futura com
                CDI/Ibovespa fica indisponível SÓ para este papel.
              </p>
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-500"
            >
              Salvar posição
            </button>
            <p className="text-[10px] leading-snug text-slate-600">
              O acesso a este app já é protegido por login na Vercel — sem
              chave extra aqui. Use os botões &quot;editar&quot;/&quot;excluir&quot; na
              tabela ao lado para alterar ou remover uma posição já
              registrada. A decisão em
              si (comprei/vendi e por quê) merece um registro no{" "}
              <Link href="/diario" className="text-sky-400 hover:underline">
                Diário
              </Link>
              , que é imutável.
            </p>
          </form>
        </section>

        {/* ---------- posições ---------- */}
        <section className="col-span-12 rounded-2xl border border-white/5 bg-white/[0.03] p-5 lg:col-span-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
              Posições ({c.linhas.length})
            </h2>
            <p className="text-[10px] text-slate-600">
              preço oficial mais recente · sem recomendação de compra ou venda
            </p>
          </div>
          {c.linhas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Nenhuma posição registrada. Registre ao lado o que você REALMENTE
              tem — a partir daí patrimônio, resultado e alocação passam a ser
              calculados com dados seus, não inventados.
            </p>
          ) : (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                    <th className="py-1.5 pr-2">Empresa</th>
                    <th className="py-1.5 pr-2 text-right">Qtd</th>
                    <th className="py-1.5 pr-2 text-right">Preço médio</th>
                    <th className="py-1.5 pr-2 text-right">Preço atual</th>
                    <th className="py-1.5 pr-2 text-right">Valor atual</th>
                    <th className="py-1.5 pr-2 text-right">Resultado</th>
                    <th className="py-1.5 pr-2 text-right">Peso</th>
                    <th className="py-1.5 pr-2 text-right">Tese</th>
                    <th className="py-1.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {c.linhas.map((l) => (
                    <tr key={l.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                      <td className="py-1.5 pr-2">
                        <Link href={`/tese/${l.ticker}`} className="hover:underline">
                          <span className="font-mono font-semibold">{l.ticker}</span>
                        </Link>
                        <span className="ml-2 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                          {l.modelo ? ROTULO_MODELO[l.modelo] : "—"}
                        </span>
                        {l.dataCompra && (
                          <span className="ml-2 text-[10px] text-slate-600">
                            desde {new Date(l.dataCompra + "T00:00:00").toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                        {l.quantidade.toLocaleString("pt-BR")}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                        {brl(l.precoMedio)}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                        {l.precoAtual !== null ? brl(l.precoAtual) : "—"}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-slate-200">
                        {l.valorAtual !== null ? brl(l.valorAtual) : "—"}
                      </td>
                      <td className={`py-1.5 pr-2 text-right font-mono ${corResultado(l.resultado)}`}>
                        {l.resultado !== null ? pct(l.resultadoPct) : "—"}
                      </td>
                      <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                        {pct(l.peso)}
                      </td>
                      <td className="py-1.5 pr-2 text-right">
                        {statusTese.has(l.ticker) ? (
                          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                            {statusTese.get(l.ticker)}
                          </span>
                        ) : (
                          <span
                            className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300"
                            title="Você tem a posição mas ainda não escreveu a tese — o sistema não sabe POR QUE você tem este papel."
                          >
                            sem tese
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 text-right">
                        <AcoesPosicao
                          ticker={l.ticker}
                          quantidade={l.quantidade}
                          precoMedio={l.precoMedio}
                          dataCompra={l.dataCompra}
                          excluirAction={salvarPosicao}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* alocação por modelo */}
          {c.alocacaoPorModelo.length > 0 && (
            <div className="mt-4 border-t border-white/5 pt-3">
              <h3 className="text-[10px] uppercase tracking-[0.25em] text-slate-600">
                Alocação por modelo de negócio
              </h3>
              <div className="mt-2 space-y-1.5">
                {c.alocacaoPorModelo.map((m) => (
                  <div key={m.rotulo} className="flex items-center gap-2 text-[11.5px]">
                    <span className="w-40 shrink-0 text-slate-400">{m.rotulo}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                      <div
                        className="h-full rounded-full bg-sky-400/60"
                        style={{ width: `${Math.max(2, m.pct * 100)}%` }}
                      />
                    </div>
                    <span className="w-12 text-right font-mono text-slate-300">{pct(m.pct)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      <p className="text-[10.5px] leading-snug text-slate-600">
        Rentabilidade, Alpha vs. CDI/IPCA/Ibovespa, drawdown e Sharpe agora aparecem em{" "}
        <Link href="/" className="text-sky-400 hover:underline">Meu Patrimônio</Link> — mas só para posições com
        <span className="text-slate-400"> data de compra</span> preenchida acima (sem data, não dá pra posicionar a
        posição no tempo e comparar com os benchmarks; nunca estimamos essa data por você). Preços datam do último
        pregão coletado
        {dataPrecoPorTicker.size > 0 && (
          <> ({[...new Set(dataPrecoPorTicker.values())].sort().reverse()[0]})</>
        )}
        . Nada nesta página é recomendação de compra ou venda.
      </p>
    </Shell>
  );
}
