import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { auditarEmpresa, type Verificacao } from "@/lib/auditoria";
import { modeloDe } from "@/lib/setores";
import { calcularDataConfidence, type Estrelas } from "@/lib/truth-data-confidence";
import { calcularDataQualityScore } from "@/lib/truth-quality-score";
import { montarQualityDashboard, type EntradaDashboardEmpresa } from "@/lib/truth-quality-dashboard";
import { resumirCoberturaHistorico, indicadoresSemHistorico } from "@/lib/truth-indicator-history";
import { resumirLacunas, LACUNAS_CONHECIDAS } from "@/lib/truth-missing-data";

export const dynamic = "force-dynamic";

/**
 * QUALITY DASHBOARD — TRUTH LAYER (Bloco 2, Sprint 2.4, Módulo 10).
 *
 * Reaproveita exatamente o mesmo padrão de consulta de /auditoria (view
 * `auditoria_dados` + fundamentos/preços/ações + `auditarEmpresa`, FDIE já
 * existente) — este painel só adiciona Data Confidence (Módulo 1) e Data
 * Quality Score (Módulo 5) por cima do que já é coletado, sem duplicar a
 * consulta nem o motor de integridade.
 */

type LinhaEmpresa = { ticker: string; nome: string; setor: string | null };
type FundRow = {
  ticker: string;
  competencia: string;
  receita_liquida: number | null;
  lucro_liquido: number | null;
  margem_bruta: number | null;
  margem_liquida: number | null;
  roic: number | null;
  divida_liquida: number | null;
  caixa: number | null;
};

function diasDesde(dataIso: string, agora: string): number {
  return Math.floor((new Date(agora).getTime() - new Date(dataIso).getTime()) / 86_400_000);
}

export default async function AuditoriaVerdade() {
  let erro: string | null = null;
  let dashboard: ReturnType<typeof montarQualityDashboard> | null = null;

  if (!isSupabaseConfigured || !supabase) {
    erro = "Supabase não configurado.";
  } else {
    const agora = new Date().toISOString();
    const [{ data: empresasRaw, error: erroEmpresas }, { data: fundsRaw, error: erroFunds }, { data: precosRaw }, { data: acoesRaw }] = await Promise.all([
      supabase.from("auditoria_dados").select("ticker, nome, setor"),
      supabase
        .from("fundamentos")
        .select("ticker, competencia, receita_liquida, lucro_liquido, margem_bruta, margem_liquida, roic, divida_liquida, caixa")
        .order("competencia", { ascending: false }),
      supabase.from("precos_diarios").select("ticker, data, fechamento, market_cap").order("data", { ascending: false }),
      supabase.from("acoes_totais").select("ticker, qtd_acoes"),
    ]);

    if (erroEmpresas || erroFunds) {
      erro = erroEmpresas?.message ?? erroFunds?.message ?? "Falha ao ler dados de auditoria.";
    } else {
      const empresas = (empresasRaw ?? []) as LinhaEmpresa[];
      const ultimoFundPorTicker = new Map<string, FundRow>();
      for (const f of (fundsRaw ?? []) as FundRow[]) {
        if (!ultimoFundPorTicker.has(f.ticker)) ultimoFundPorTicker.set(f.ticker, f);
      }
      const ultimoPrecoPorTicker = new Map<string, { fechamento: number | null; market_cap: number | null }>();
      for (const p of (precosRaw ?? []) as { ticker: string; fechamento: number | null; market_cap: number | null }[]) {
        if (!ultimoPrecoPorTicker.has(p.ticker)) ultimoPrecoPorTicker.set(p.ticker, p);
      }
      const qtdAcoesPorTicker = new Map(((acoesRaw ?? []) as { ticker: string; qtd_acoes: number }[]).map((a) => [a.ticker, Number(a.qtd_acoes)]));

      const entradasDashboard: EntradaDashboardEmpresa[] = empresas.map((e) => {
        const f = ultimoFundPorTicker.get(e.ticker);
        const p = ultimoPrecoPorTicker.get(e.ticker);
        const verificacoes: Verificacao[] = auditarEmpresa({
          ticker: e.ticker,
          modelo: modeloDe(e.ticker),
          cotacao: p?.fechamento ?? null,
          qtdAcoes: qtdAcoesPorTicker.get(e.ticker) ?? null,
          marketCapBruto: p?.market_cap ?? null,
          receita: f?.receita_liquida ?? null,
          lucro: f?.lucro_liquido ?? null,
          margemBruta: f?.margem_bruta ?? null,
          margemLiquida: f?.margem_liquida ?? null,
          roic: f?.roic ?? null,
          dividaLiquida: f?.divida_liquida ?? null,
          caixa: f?.caixa ?? null,
        });

        const idadeDias = f ? diasDesde(`${f.competencia}T00:00:00Z`, agora) : null;
        const estrelasPorIndicador: Record<string, Estrelas> = {};
        const indicadoresComValor: [string, number | null][] = [
          ["receita", f?.receita_liquida ?? null],
          ["margem", f?.margem_liquida ?? null],
          ["roic", f?.roic ?? null],
        ];
        for (const [nome, valor] of indicadoresComValor) {
          if (valor === null) continue;
          estrelasPorIndicador[nome] = calcularDataConfidence({
            confiabilidadeFonte: "alta",
            idadeDias,
            verificacoesFdie: verificacoes,
            divergenciaConhecida: false,
            temLineage: true,
          }).estrelas;
        }

        const qualityScore = calcularDataQualityScore(
          { ticker: e.ticker, estrelasPorIndicador, verificacoesFdie: verificacoes, ultimaAuditoria: agora },
          ["receita", "margem", "roic"]
        );
        return { score: qualityScore, setor: e.setor };
      });

      dashboard = montarQualityDashboard(entradasDashboard);
    }
  }

  const coberturaHistorico = resumirCoberturaHistorico();
  const lacunas = resumirLacunas();
  const semHistorico = indicadoresSemHistorico();

  return (
    <Shell ativo="/auditoria/verdade" titulo="Auditoria — Truth Layer">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-[12px] text-slate-500">
          Data Quality Score por empresa/setor, cobertura de histórico por indicador e o registro de lacunas conhecidas. Nada aqui usa IA — são regras determinísticas sobre dado já coletado.
        </p>

        {erro && <p className="mt-6 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-[13px] text-rose-300">{erro}</p>}

        {dashboard && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card titulo="Empresas auditadas" valor={dashboard.empresasTotal} />
              <Card titulo="Score médio geral" valor={`${dashboard.scoreMedioGeral}/100`} />
              <Card titulo="Confirmados (≥80)" valor={dashboard.confirmados} />
              <Card titulo="Com campo pendente" valor={dashboard.pendentes} />
            </div>

            {dashboard.porSetor.length > 0 && (
              <div className="mt-8">
                <h2 className="text-[13px] font-semibold text-slate-300">Cobertura por setor</h2>
                <table className="mt-2 w-full text-[12px]">
                  <thead>
                    <tr className="text-left text-slate-500">
                      <th className="pb-1 pr-3">Setor</th>
                      <th className="pb-1 pr-3">Empresas</th>
                      <th className="pb-1">Score médio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboard.porSetor.map((s) => (
                      <tr key={s.setor} className="border-t border-white/5 text-slate-300">
                        <td className="py-1.5 pr-3">{s.setor}</td>
                        <td className="py-1.5 pr-3">{s.empresas}</td>
                        <td className="py-1.5">{s.scoreMedio}/100</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-600">Cobertura de histórico por indicador</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">
              {coberturaHistorico.comHistorico}/{coberturaHistorico.total} ({coberturaHistorico.percentualCobertura}%)
            </p>
            <ul className="mt-2 space-y-1">
              {semHistorico.map((i) => (
                <li key={i.indicador} className="text-[11px] text-slate-500">
                  <span className="text-slate-400">{i.rotulo}:</span> {i.motivoAusencia}
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-600">Lacunas conhecidas (Missing Data Registry)</p>
            <p className="mt-1 text-lg font-semibold text-slate-100">{lacunas.total} registradas</p>
            <ul className="mt-2 space-y-1">
              {LACUNAS_CONHECIDAS.slice(0, 5).map((l) => (
                <li key={l.id} className="text-[11px] text-slate-500">
                  <span className="text-slate-400">{l.dado}:</span> {l.dependeDe}
                  {l.sprint && <span className="text-slate-600"> — {l.sprint}</span>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: number | string }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{titulo}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">{valor}</p>
    </div>
  );
}
