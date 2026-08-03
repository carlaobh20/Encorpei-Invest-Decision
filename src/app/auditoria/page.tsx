import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { auditarEmpresa, resumoSeveridade, type Verificacao } from "@/lib/auditoria";
import { modeloDe } from "@/lib/setores";

export const dynamic = "force-dynamic";

type LinhaAuditoria = {
  ticker: string;
  nome: string;
  setor: string | null;
  ri_url: string | null;
  ultimo_preco: string | null;
  dias_coletados: number;
  ultimo_trimestre: string | null;
};

function fmt(d: string | null) {
  if (!d) return "—";
  const [ano, mes, dia] = d.split("-");
  return `${dia}/${mes}/${ano}`;
}

function atrasado(ultimoPreco: string | null): boolean {
  if (!ultimoPreco) return true;
  const dias =
    (Date.now() - new Date(ultimoPreco + "T12:00:00-03:00").getTime()) / 86_400_000;
  return dias > 4;
}

export default async function Auditoria() {
  let linhas: LinhaAuditoria[] = [];
  let erro: string | null = null;
  const verificacoes: Verificacao[] = [];
  let erroIntegridade: string | null = null;

  if (!isSupabaseConfigured || !supabase) {
    erro = "Supabase não configurado.";
  } else {
    const { data, error } = await supabase
      .from("auditoria_dados")
      .select("*")
      .order("ticker");
    if (error) erro = error.message;
    else linhas = (data as LinhaAuditoria[]) ?? [];

    // ---------- MOTOR DE INTEGRIDADE (v1 do FDIE) ----------
    // Cruza os mesmos dados oficiais que o resto do sistema já usa — sem
    // nenhuma chamada nova, sem custo novo. Ver src/lib/auditoria.ts.
    const [{ data: fundsRaw, error: errFunds }, { data: precosRaw }, { data: acoesRaw }] = await Promise.all([
      supabase
        .from("fundamentos")
        .select("ticker, competencia, fonte, receita_liquida, lucro_liquido, margem_bruta, margem_liquida, roic, divida_liquida, caixa")
        .order("competencia", { ascending: false }),
      supabase.from("precos_diarios").select("ticker, data, fechamento, market_cap").order("data", { ascending: false }),
      supabase.from("acoes_totais").select("ticker, qtd_acoes"),
    ]);
    if (errFunds) {
      erroIntegridade = errFunds.message;
    } else {
      type FundRow = {
        ticker: string;
        receita_liquida: number | null;
        lucro_liquido: number | null;
        margem_bruta: number | null;
        margem_liquida: number | null;
        roic: number | null;
        divida_liquida: number | null;
        caixa: number | null;
      };
      const ultimoFundPorTicker = new Map<string, FundRow>();
      for (const f of (fundsRaw as FundRow[]) ?? []) {
        if (!ultimoFundPorTicker.has(f.ticker)) ultimoFundPorTicker.set(f.ticker, f);
      }
      const ultimoPrecoPorTicker = new Map<string, { fechamento: number | null; market_cap: number | null }>();
      for (const p of (precosRaw as { ticker: string; fechamento: number | null; market_cap: number | null }[]) ?? []) {
        if (!ultimoPrecoPorTicker.has(p.ticker)) ultimoPrecoPorTicker.set(p.ticker, p);
      }
      const qtdAcoesPorTicker = new Map(
        (((acoesRaw as { ticker: string; qtd_acoes: number }[]) ?? [])).map((a) => [a.ticker, Number(a.qtd_acoes)])
      );

      for (const l of linhas) {
        const f = ultimoFundPorTicker.get(l.ticker);
        const p = ultimoPrecoPorTicker.get(l.ticker);
        verificacoes.push(
          ...auditarEmpresa({
            ticker: l.ticker,
            modelo: modeloDe(l.ticker),
            cotacao: p?.fechamento ?? null,
            qtdAcoes: qtdAcoesPorTicker.get(l.ticker) ?? null,
            marketCapBruto: p?.market_cap ?? null,
            receita: f?.receita_liquida ?? null,
            lucro: f?.lucro_liquido ?? null,
            margemBruta: f?.margem_bruta ?? null,
            margemLiquida: f?.margem_liquida ?? null,
            roic: f?.roic ?? null,
            dividaLiquida: f?.divida_liquida ?? null,
            caixa: f?.caixa ?? null,
          })
        );
      }
    }
  }

  const atrasadas = linhas.filter((l) => atrasado(l.ultimo_preco)).length;
  const resumo = resumoSeveridade(verificacoes);
  const achados = verificacoes
    .filter((v) => v.severidade !== "ok")
    .sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "critico" ? -1 : 1));

  return (
    <Shell
      ativo="/auditoria"
      titulo="Auditoria de dados"
      subtitulo="Última data coletada por empresa, direto da fonte oficial (CVM + bolsa). Sem dado confiável aqui, nenhuma nota lá na frente vale nada — por isso esta tela existe."
    >
      <div className="flex gap-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2">
          <p className="text-lg font-bold text-slate-100">{linhas.length}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">empresas vigiadas</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2">
          <p className={`text-lg font-bold ${atrasadas > 0 ? "text-red-400" : "text-emerald-300"}`}>
            {atrasadas}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">com dado atrasado</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2">
          <p className="text-lg font-bold text-slate-100">{resumo.total}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">verificações de integridade</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2">
          <p className={`text-lg font-bold ${resumo.critico > 0 ? "text-red-400" : "text-emerald-300"}`}>
            {resumo.critico}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">críticas</p>
        </div>
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2">
          <p className={`text-lg font-bold ${resumo.alerta > 0 ? "text-amber-400" : "text-emerald-300"}`}>
            {resumo.alerta}
          </p>
          <p className="text-[10px] uppercase tracking-wider text-slate-500">alertas</p>
        </div>
      </div>

      {erro && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
          {erro}
        </div>
      )}
      {erroIntegridade && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
          Motor de integridade: {erroIntegridade}
        </div>
      )}

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            Motor de integridade — verificações cruzadas (v1)
          </h2>
          <p className="text-[10px] text-slate-600">
            {resumo.total} verificações rodadas · nenhuma chamada a API paga · nenhum dado estimado
          </p>
        </div>
        {achados.length === 0 ? (
          <p className="mt-2 text-[12.5px] text-emerald-300/90">
            Nenhuma divergência encontrada — as {resumo.total} verificações passaram (valor de mercado,
            margem líquida ≤ bruta, margem recalculada, indicador compatível com o modelo setorial, caixa
            não-negativo).
          </p>
        ) : (
          <div className="mt-2 max-h-56 overflow-y-auto pr-1">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                  <th className="py-1.5 pr-3">Severidade</th>
                  <th className="py-1.5 pr-3">Verificação</th>
                  <th className="py-1.5">Mensagem</th>
                </tr>
              </thead>
              <tbody>
                {achados.map((v) => (
                  <tr key={v.id} className="border-t border-white/5">
                    <td className="py-1.5 pr-3">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider ${
                          v.severidade === "critico"
                            ? "border-red-500/30 bg-red-500/10 text-red-300"
                            : "border-amber-500/30 bg-amber-500/10 text-amber-300"
                        }`}
                      >
                        {v.severidade}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-300">{v.nome}</td>
                    <td className="py-1.5 text-slate-400">{v.mensagem}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-[10.5px] leading-snug text-slate-600">
          O que isso NÃO cobre ainda: comparação com Fundamentus/Status Invest/TradingView (exige API paga —
          decisão do Carlos) e citação de página de PDF da CVM (o pipeline lê dados estruturados, não escaneia
          PDF). Roadmap completo em roadmap/fdie-fase1.md.
        </p>
      </section>

      <div className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-white/5 bg-white/[0.03] p-4 pr-2">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10 bg-[#050b18]/95 backdrop-blur">
            <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
              <th className="py-2 pr-3">Status</th>
              <th className="py-2 pr-3">Empresa</th>
              <th className="py-2 pr-3">Setor</th>
              <th className="py-2 pr-3 text-right">Último preço</th>
              <th className="py-2 pr-3 text-right">Pregões</th>
              <th className="py-2 pr-3 text-right">Último trimestre</th>
              <th className="py-2 text-right">RI</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => {
              const atraso = atrasado(l.ultimo_preco);
              return (
                <tr key={l.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="py-2 pr-3">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${
                        atraso ? "bg-red-400" : "bg-emerald-400"
                      }`}
                      title={atraso ? "dado atrasado" : "em dia"}
                    />
                  </td>
                  <td className="py-2 pr-3">
                    <span className="font-mono font-semibold">{l.ticker}</span>
                    <span className="ml-2 text-slate-400">{l.nome}</span>
                  </td>
                  <td className="py-2 pr-3 text-slate-500">{l.setor ?? "—"}</td>
                  <td className={`py-2 pr-3 text-right font-mono ${atraso ? "text-red-400" : "text-slate-300"}`}>
                    {fmt(l.ultimo_preco)}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-slate-400">
                    {l.dias_coletados}
                  </td>
                  <td className="py-2 pr-3 text-right font-mono text-slate-300">
                    {fmt(l.ultimo_trimestre)}
                  </td>
                  <td className="py-2 text-right">
                    {l.ri_url && (
                      <a
                        href={l.ri_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-md border border-white/10 px-2 py-0.5 text-[11px] text-emerald-400/90 hover:border-emerald-500/40"
                      >
                        RI ↗
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
            {linhas.length === 0 && !erro && (
              <tr>
                <td colSpan={7} className="py-6 text-slate-500">
                  Nenhuma empresa cadastrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
