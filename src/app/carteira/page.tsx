import { revalidatePath } from "next/cache";
import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { Shell } from "@/components/Shell";
import { GraficoPatrimonio } from "@/components/GraficoPatrimonio";
import { AcoesPosicao } from "@/components/AcoesPosicao";
import { consolidarCarteira, notaPonderada, type Posicao } from "@/lib/carteira";
import { calcularRadar } from "@/lib/radar";
import { calcularCompounders } from "@/lib/compounder-dados";
import { calcularConfluencias } from "@/lib/confluencia-dados";
import { calcularSaudeCarteira, confluenciaMediaPonderada, montarLinhasSaude } from "@/lib/portfolio-health";
import { calcularPatrimonio } from "@/lib/patrimonio-dados";
import { ROTULO_MODELO } from "@/lib/setores";
import { ROTULO_SENSIBILIDADE } from "@/lib/compounder/sensibilidade-juros";
import { ROTULO_CONVICCAO, type Conviccao } from "@/lib/confluencia";

export const dynamic = "force-dynamic";

/**
 * MINHA CARTEIRA (mesclagem "/carteira" + "/saude-carteira", 03/08/2026) —
 * mesmo vocabulário visual "dark glass" do redesign da home (Shell.tsx,
 * cards `rounded-[20px] border border-white/[0.06] bg-white/[0.03]`,
 * `Painel`/`Stat` locais no mesmo espírito dos de page.tsx).
 *
 * O que entrou aqui: tudo que já existia em /carteira (registrar/editar/
 * excluir posição, tabela de posições) + tudo que já existia em
 * /saude-carteira (concentração, Carry médio, ROIC médio, Valuation médio,
 * sensibilidade à Selic, diversificação por modelo) — fusão ADITIVA, nada
 * foi removido. Novidades desta fusão: Confluence por posição e da
 * carteira (confluencia.ts/confluencia-dados.ts), Volatilidade anualizada
 * (patrimonio.ts, mesmo gate honesto do Sharpe/Sortino), donut de alocação
 * por modelo e o gráfico "Evolução do patrimônio" (GraficoPatrimonio,
 * reusado tal qual da home).
 *
 * Deliberadamente NÃO existe aqui: "Exposição por fator" (Value/Growth/
 * Dividendos/Cíclicas/Defensivas/Caixa) — não há tabela nem motor que
 * classifique empresas nesses fatores hoje. Nenhum card, nem com dado
 * parcial ou estimado: corte honesto é omitir a seção inteira.
 *
 * Nunca "compre"/"venda"/"recomendamos". Todo número vem de uma variável
 * calculada a partir de dado real — nunca um valor decorativo.
 */

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number | null, casas = 1) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: casas })}%`;

const ROTULO_CONCENTRACAO: Record<string, string> = {
  baixa: "Baixa",
  moderada: "Moderada",
  alta: "Alta",
  muito_alta: "Muito alta",
};
const COR_CONCENTRACAO: Record<string, string> = {
  baixa: "text-emerald-300",
  moderada: "text-sky-300",
  alta: "text-amber-300",
  muito_alta: "text-red-300",
};
const COR_CONVICCAO: Record<Conviccao, string> = {
  alta: "text-emerald-300",
  moderada: "text-sky-300",
  baixa: "text-amber-300",
  indefinida: "text-slate-500",
};
const CHIP_CONVICCAO: Record<Conviccao, string> = {
  alta: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  moderada: "text-sky-300 bg-sky-500/10 border-sky-500/30",
  baixa: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  indefinida: "text-slate-500 bg-white/[0.03] border-white/10",
};
const PALETA_MODELO = ["#22e0a6", "#38bdf8", "#facc15", "#a78bfa", "#fb7185", "#f97316", "#34d399", "#94a3b8"];

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
  revalidatePath("/saude-carteira");
  revalidatePath("/");
}

/** Painel interno — mesmo visual das páginas internas / da home redesenhada. */
function Painel({
  titulo, acao, children,
}: {
  titulo: string; acao?: { href: string; rotulo: string }; children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-[18px] border border-white/5 bg-white/[0.025] p-4">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[10.5px] uppercase tracking-[0.22em] text-slate-500">{titulo}</h3>
        {acao && (
          <Link href={acao.href} className="text-[11px] text-sky-400 hover:underline">
            {acao.rotulo} →
          </Link>
        )}
      </div>
      <div className="mt-2 min-h-0 flex-1">{children}</div>
    </section>
  );
}

/** Estatística tipo "stat tile" — mesmo componente/espírito do usado na home. */
function Stat({
  rotulo, valor, cor = "text-slate-100", nota,
}: { rotulo: string; valor: string; cor?: string; nota?: string }) {
  return (
    <div>
      <p className={`font-mono text-xl font-bold ${cor}`}>{valor}</p>
      <p className="text-[10px] uppercase tracking-wider text-slate-500">{rotulo}</p>
      {nota && <p className="mt-0.5 text-[9.5px] leading-snug text-slate-600">{nota}</p>}
    </div>
  );
}

/** Donut de alocação por modelo — SVG puro, mesmo padrão hand-rolled do GraficoPatrimonio. */
function DonutAlocacao({ dados }: { dados: { rotulo: string; pct: number }[] }) {
  const R = 58;
  const C = 2 * Math.PI * R;
  let acumulado = 0;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg viewBox="0 0 150 150" className="h-32 w-32 shrink-0" role="img" aria-label="Alocação por modelo de negócio">
        <circle cx="75" cy="75" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="16" />
        <g transform="rotate(-90 75 75)">
          {dados.map((d, i) => {
            const dash = Math.max(0, d.pct * C);
            const offset = -acumulado * C;
            acumulado += d.pct;
            return (
              <circle
                key={d.rotulo}
                cx="75"
                cy="75"
                r={R}
                fill="none"
                stroke={PALETA_MODELO[i % PALETA_MODELO.length]}
                strokeWidth="16"
                strokeDasharray={`${dash} ${Math.max(0, C - dash)}`}
                strokeDashoffset={offset}
              />
            );
          })}
        </g>
      </svg>
      <div className="min-w-0 flex-1 space-y-1.5">
        {dados.map((d, i) => (
          <div key={d.rotulo} className="flex items-center gap-2 text-[11.5px]">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: PALETA_MODELO[i % PALETA_MODELO.length] }}
            />
            <span className="truncate text-slate-300">{d.rotulo}</span>
            <span className="ml-auto shrink-0 font-mono text-slate-400">{pct(d.pct)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default async function Carteira() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/carteira" titulo="Minha Carteira">
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
      <Shell ativo="/carteira" titulo="Minha Carteira">
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

  const [
    { data: empresasRaw },
    { data: precosRaw },
    { data: scoresRaw },
    { data: tesesRaw },
    radarLinhas,
    compounderLinhas,
    confluenciaLinhas,
    patrimonio,
  ] = await Promise.all([
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
    calcularRadar(supabase),
    calcularCompounders(supabase),
    calcularConfluencias(supabase),
    calcularPatrimonio(supabase),
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
  const confluenciaPorTicker = new Map(confluenciaLinhas.map((l) => [l.ticker, l.resultado]));

  const c = consolidarCarteira(posicoes, precoPorTicker);
  const nota = notaPonderada(c.linhas, notaPorTicker);
  const confluenciaCarteira = confluenciaMediaPonderada(
    c.linhas.map((l) => ({ peso: l.peso ?? 0, score: confluenciaPorTicker.get(l.ticker)?.score ?? null }))
  );
  const corResultado = (v: number | null) =>
    v === null ? "text-slate-500" : v >= 0 ? "text-emerald-300" : "text-red-300";

  // ---------- Saúde da Carteira (assembly compartilhado com a home — ver portfolio-health.ts) ----------
  const linhasSaude = montarLinhasSaude(c.linhas, radarLinhas, compounderLinhas);
  const saude = linhasSaude.length > 0 ? calcularSaudeCarteira(linhasSaude) : null;

  const volatilidade = patrimonio?.resultado.volatilidadeAnualizada ?? null;
  const totalPesoTxt = c.valorAtual !== null ? "100%" : "—";

  return (
    <Shell
      ativo="/carteira"
      titulo="Minha Carteira"
      subtitulo="Suas posições reais + saúde da carteira num só lugar — preço oficial mais recente, nota e Confluence por posição. Registro imutável de cada decisão continua no Diário."
      rolagem
    >
      {/* ================= topo: 6 stat cards ================= */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <Stat rotulo="Investido" valor={brl(c.valorInvestido)} />
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <Stat rotulo="Valor atual" valor={c.valorAtual !== null ? brl(c.valorAtual) : "—"} />
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <Stat
            rotulo="Resultado"
            valor={c.resultado !== null ? `${brl(c.resultado)} (${pct(c.resultadoPct)})` : "—"}
            cor={corResultado(c.resultado)}
          />
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <Stat
            rotulo="Nota média (ponderada)"
            valor={nota !== null ? Math.round(nota).toString() : "—"}
            cor="text-sky-300"
            nota={nota === null && posicoes.length > 0 ? "só com nota oficial de todas as posições" : undefined}
          />
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <Stat
            rotulo="Confluence da carteira"
            valor={confluenciaCarteira.valor !== null ? Math.round(confluenciaCarteira.valor).toString() : "—"}
            cor={COR_CONVICCAO[confluenciaCarteira.conviccao]}
            nota={`${ROTULO_CONVICCAO[confluenciaCarteira.conviccao]} da carteira`}
          />
        </div>
        <div className="rounded-[18px] border border-white/[0.06] bg-white/[0.03] px-4 py-3">
          <Stat
            rotulo="Carry médio (ponderado)"
            valor={
              saude && saude.carryMedioPonderado !== null
                ? `IPCA + ${(saude.carryMedioPonderado * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                : "—"
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        {/* ================= Saúde da Carteira ================= */}
        <section className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-5 sm:p-6 xl:col-span-5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Saúde da Carteira</h2>
          {saude ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <Stat
                  rotulo="Confluence geral"
                  valor={confluenciaCarteira.valor !== null ? Math.round(confluenciaCarteira.valor).toString() : "—"}
                  cor={COR_CONVICCAO[confluenciaCarteira.conviccao]}
                  nota={`cobertura ${confluenciaCarteira.cobertura}/${confluenciaCarteira.total} posições`}
                />
                <Stat
                  rotulo="Concentração"
                  valor={ROTULO_CONCENTRACAO[saude.concentracaoRotulo]}
                  cor={COR_CONCENTRACAO[saude.concentracaoRotulo]}
                  nota={`HHI ${saude.concentracaoHHI.toFixed(3)}${
                    saude.maiorPosicao ? ` · maior: ${saude.maiorPosicao.ticker} (${pct(saude.maiorPosicao.peso)})` : ""
                  }`}
                />
                <Stat
                  rotulo="Carry médio"
                  valor={
                    saude.carryMedioPonderado !== null
                      ? `IPCA + ${(saude.carryMedioPonderado * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`
                      : "—"
                  }
                  nota={`cobertura ${saude.cobertura.carry}/${saude.cobertura.total}`}
                />
                <Stat
                  rotulo="Volatilidade (anualizada)"
                  valor={volatilidade !== null ? `${(volatilidade * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%` : "—"}
                  nota={
                    volatilidade === null
                      ? patrimonio?.resultado.motivoSemSharpe ?? "Sem série suficiente desde a data de compra ainda."
                      : "desvio padrão anualizado dos retornos diários da carteira"
                  }
                />
                <Stat rotulo="ROIC médio" valor={pct(saude.roicMedioPonderado)} nota={`cobertura ${saude.cobertura.roic}/${saude.cobertura.total} · sem bancos/seguradoras`} />
                <Stat
                  rotulo="Valuation médio"
                  valor={pct(saude.earningsYieldMedioPonderado)}
                  nota={`lucro 12m ÷ valor de mercado · cobertura ${saude.cobertura.valuation}/${saude.cobertura.total}`}
                />
                <Stat
                  rotulo="Sensibilidade à Selic"
                  valor={saude.sensibilidadeSelicMedia.categoria ? ROTULO_SENSIBILIDADE[saude.sensibilidadeSelicMedia.categoria] : "—"}
                  nota={saude.sensibilidadeSelicMedia.explicacao}
                />
                <Stat rotulo="Posições" valor={String(saude.cobertura.total)} />
              </div>

              {saude.alocacaoPorModelo.length > 0 && (
                <div className="mt-5 border-t border-white/5 pt-4">
                  <h3 className="text-[10px] uppercase tracking-[0.25em] text-slate-600">
                    Diversificação por modelo de negócio
                  </h3>
                  <div className="mt-2 space-y-1.5">
                    {saude.alocacaoPorModelo.map((m) => (
                      <div key={m.rotulo} className="flex items-center gap-2 text-[11.5px]">
                        <span className="w-32 shrink-0 truncate text-slate-400">{m.rotulo}</span>
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                          <div className="h-full rounded-full bg-sky-400/60" style={{ width: `${Math.max(2, m.pct * 100)}%` }} />
                        </div>
                        <span className="w-12 shrink-0 text-right font-mono text-slate-300">{pct(m.pct)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">
              {posicoes.length === 0
                ? "Registre suas posições reais ao lado para habilitar a Saúde da Carteira."
                : "Ainda falta preço atual para calcular o peso de alguma posição — sem isso não dá pra medir concentração, Carry ou ROIC ponderados honestamente."}
            </p>
          )}
        </section>

        {/* ================= Minha Carteira (tabela) ================= */}
        <section className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-5 sm:p-6 xl:col-span-7">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
              Minha Carteira ({c.linhas.length})
            </h2>
            <p className="text-[10px] text-slate-600">preço oficial mais recente · sem recomendação de compra ou venda</p>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href="#form-posicao"
              className="rounded-lg border border-sky-400/30 bg-sky-500/10 px-3 py-1.5 text-[12px] font-medium text-sky-200 transition-colors hover:bg-sky-500/20"
            >
              + Adicionar ativo
            </a>
            <Link
              href="/diario"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-slate-300 transition-colors hover:bg-white/[0.05]"
            >
              + Adicionar ação
            </Link>
            <Link
              href="/em-breve?m=rebalancear"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-[12px] text-slate-400 transition-colors hover:bg-white/[0.05]"
            >
              ↻ Rebalancear
            </Link>
          </div>

          {c.linhas.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              Nenhuma posição registrada. Use &quot;+ Adicionar ativo&quot; para registrar o que você REALMENTE tem —
              a partir daí patrimônio, resultado e alocação passam a ser calculados com dados seus, não inventados.
            </p>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                    <th className="py-1.5 pr-2">Empresa</th>
                    <th className="py-1.5 pr-2 text-right">Qtd</th>
                    <th className="py-1.5 pr-2 text-right">Preço médio</th>
                    <th className="py-1.5 pr-2 text-right">Preço atual</th>
                    <th className="py-1.5 pr-2 text-right">Valor investido</th>
                    <th className="py-1.5 pr-2 text-right">Valor atual</th>
                    <th className="py-1.5 pr-2 text-right">Resultado</th>
                    <th className="py-1.5 pr-2 text-right">Peso</th>
                    <th className="py-1.5 pr-2 text-right">Nota</th>
                    <th className="py-1.5 pr-2 text-right">Confluence</th>
                    <th className="py-1.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {c.linhas.map((l) => {
                    const notaLinha = notaPorTicker.get(l.ticker);
                    const conf = confluenciaPorTicker.get(l.ticker);
                    return (
                      <tr key={l.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                        <td className="py-1.5 pr-2">
                          <Link href={`/tese/${l.ticker}`} className="hover:underline">
                            <span className="font-mono font-semibold">{l.ticker}</span>
                          </Link>
                          <span className="ml-2 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                            {l.modelo ? ROTULO_MODELO[l.modelo] : "—"}
                          </span>
                          {!statusTese.has(l.ticker) && (
                            <span
                              className="ml-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] text-amber-300"
                              title="Você tem a posição mas ainda não escreveu a tese — o sistema não sabe POR QUE você tem este papel."
                            >
                              sem tese
                            </span>
                          )}
                          {l.dataCompra && (
                            <span className="ml-2 text-[10px] text-slate-600">
                              desde {new Date(l.dataCompra + "T00:00:00").toLocaleDateString("pt-BR")}
                            </span>
                          )}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                          {l.quantidade.toLocaleString("pt-BR")}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{brl(l.precoMedio)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                          {l.precoAtual !== null ? brl(l.precoAtual) : "—"}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{brl(l.valorInvestido)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-200">
                          {l.valorAtual !== null ? brl(l.valorAtual) : "—"}
                        </td>
                        <td className={`py-1.5 pr-2 text-right font-mono ${corResultado(l.resultado)}`}>
                          {l.resultado !== null ? pct(l.resultadoPct) : "—"}
                        </td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{pct(l.peso)}</td>
                        <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                          {notaLinha !== undefined ? Math.round(notaLinha) : "—"}
                        </td>
                        <td className="py-1.5 pr-2 text-right">
                          {conf && conf.score !== null ? (
                            <span
                              title={ROTULO_CONVICCAO[conf.conviccao]}
                              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-mono ${CHIP_CONVICCAO[conf.conviccao]}`}
                            >
                              {conf.score}
                            </span>
                          ) : (
                            <span className="text-slate-600">—</span>
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
                    );
                  })}
                  <tr className="border-t border-white/10 bg-white/[0.025] font-semibold">
                    <td className="py-2 pr-2 text-[11px] uppercase tracking-wider text-slate-400">TOTAL</td>
                    <td className="py-2 pr-2 text-right text-slate-700">—</td>
                    <td className="py-2 pr-2 text-right text-slate-700">—</td>
                    <td className="py-2 pr-2 text-right text-slate-700">—</td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-200">{brl(c.valorInvestido)}</td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-100">
                      {c.valorAtual !== null ? brl(c.valorAtual) : "—"}
                    </td>
                    <td className={`py-2 pr-2 text-right font-mono ${corResultado(c.resultado)}`}>
                      {c.resultado !== null ? pct(c.resultadoPct) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">{totalPesoTxt}</td>
                    <td className="py-2 pr-2 text-right font-mono text-sky-300">
                      {nota !== null ? Math.round(nota) : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono text-slate-300">
                      {confluenciaCarteira.valor !== null ? Math.round(confluenciaCarteira.valor) : "—"}
                    </td>
                    <td />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* ================= registrar / atualizar posição (form sempre acessível) ================= */}
      <section id="form-posicao-secao" className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-5 sm:p-6">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
          Registrar / atualizar posição
        </h2>
        <form id="form-posicao" action={salvarPosicao} className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-4 sm:items-end">
          <select
            id="f-ticker"
            name="ticker"
            required
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 focus:border-sky-400/50 focus:outline-none sm:col-span-1"
          >
            <option value="">Empresa…</option>
            {empresas.map((e) => (
              <option key={e.ticker} value={e.ticker}>
                {e.ticker} — {e.nome}
              </option>
            ))}
          </select>
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
          <input
            id="f-data"
            type="date"
            name="data_compra"
            max={new Date().toISOString().slice(0, 10)}
            className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:border-sky-400/50 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white transition-colors hover:bg-sky-500 sm:col-span-4"
          >
            Salvar posição
          </button>
        </form>
        <p className="mt-2 text-[10px] leading-snug text-slate-600">
          Data de compra é opcional — sem ela, a comparação futura com CDI/Ibovespa fica indisponível SÓ para este
          papel. O acesso a este app já é protegido por login na Vercel — sem chave extra aqui. Use os botões
          &quot;editar&quot;/&quot;excluir&quot; na tabela acima para alterar ou remover uma posição já registrada. A
          decisão em si (comprei/vendi e por quê) merece um registro no{" "}
          <Link href="/diario" className="text-sky-400 hover:underline">Diário</Link>, que é imutável.
        </p>
      </section>

      {/* ================= donut de alocação + evolução do patrimônio ================= */}
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
        <section className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-5 sm:p-6 xl:col-span-4">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            Alocação por modelo de negócio
          </h2>
          <div className="mt-4">
            {c.alocacaoPorModelo.length > 0 ? (
              <DonutAlocacao dados={c.alocacaoPorModelo} />
            ) : (
              <p className="text-[12px] leading-relaxed text-slate-500">
                {posicoes.length === 0
                  ? "Registre posições para ver a alocação por modelo de negócio."
                  : "Falta preço atual de alguma posição para calcular a alocação honestamente."}
              </p>
            )}
          </div>
        </section>

        <section className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] p-5 sm:p-6 xl:col-span-8">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">
            Evolução do patrimônio
          </h2>
          <div className="mt-4">
            {patrimonio && patrimonio.resultado.pontos.length >= 2 ? (
              <GraficoPatrimonio pontos={patrimonio.resultado.pontos} />
            ) : (
              <p className="text-[12.5px] leading-relaxed text-slate-500">
                {!patrimonio || patrimonio.posicoesForaDaSerie.length === 0 ? (
                  <>Ainda não há série suficiente (2+ pregões) desde a data de compra para desenhar o gráfico.</>
                ) : (
                  <>
                    Comparação com CDI/IPCA/Ibovespa ainda indisponível — falta a data de compra de{" "}
                    <span className="font-mono text-slate-400">{patrimonio.posicoesForaDaSerie.join(", ")}</span>.
                    Nunca estimamos essa data por você — preencha acima no formulário de registro.
                  </>
                )}
              </p>
            )}
          </div>
        </section>
      </div>

      {/* ================= rodapé: método e fontes reais ================= */}
      <p className="text-[10.5px] leading-snug text-slate-600">
        Método: valor investido, valor atual e resultado vêm direto das posições registradas × preço oficial mais
        recente. Performance (Alpha vs. CDI/IPCA/Ibovespa, drawdown, Sharpe, Sortino, Volatilidade) simula, para cada
        posição com data de compra registrada, &quot;se esse valor investido tivesse ido para o benchmark&quot; —
        curva comparável em R$ com a carteira real (mesmos aportes, mesmas datas). Quando o histórico de preço da
        ação é mais curto que a data de compra registrada, a comparação começa no primeiro pregão coberto pelos
        dois lados, não na data de compra em si — nunca estimamos preço ou benchmark antes do que existe.
        Sharpe/Sortino/Volatilidade só aparecem quando a série acumulada tem histórico suficiente (corte honesto —
        nunca estimados). Ibovespa em particular tem histórico curto hoje (coleta diária via brapi, sem fonte
        gratuita de backfill) — a linha do gráfico só aparece quando há 2+ pregões coletados. Nota vem das
        réguas de fundamentos versionadas; Confluence combina Fundamentos+Carry+Compounder+Technical (ver{" "}
        <Link href="/algoritmo" className="text-sky-400 hover:underline">Algoritmo</Link>). Fontes: fundamentos via
        CVM, preços via brapi, CDI/IPCA/Selic via BCB/SGS. Preços datam do último pregão coletado
        {dataPrecoPorTicker.size > 0 && (
          <> ({[...new Set(dataPrecoPorTicker.values())].sort().reverse()[0]})</>
        )}
        . Metodologia completa em src/lib/patrimonio.ts e src/lib/portfolio-health.ts. Nada nesta página é
        recomendação de compra ou venda.
      </p>
    </Shell>
  );
}
