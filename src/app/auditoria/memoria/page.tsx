import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { resumirAuditoriaMemoria, resumirLogsColeta, type LinhaEvidenciaAuditoria, type LinhaLogColeta } from "@/lib/memory-layer-auditoria";

export const dynamic = "force-dynamic";

/**
 * PAINEL DE AUDITORIA — MEMORY LAYER (Bloco 2, Sprint 2.3).
 * Só leitura e agregação (resumirAuditoriaMemoria/resumirLogsColeta, ambas
 * puras e testadas) — nenhum cálculo de negócio acontece aqui.
 */
export default async function AuditoriaMemoria() {
  let erro: string | null = null;
  let resumo: ReturnType<typeof resumirAuditoriaMemoria> | null = null;
  let resumoLogs: ReturnType<typeof resumirLogsColeta> | null = null;

  if (!isSupabaseConfigured || !supabase) {
    erro = "Supabase não configurado.";
  } else {
    const agora = new Date().toISOString();
    const [{ data: evidencias, error: erroEv }, { data: logs, error: erroLogs }] = await Promise.all([
      supabase.from("evidencias").select("ticker, categoria, origem, confiabilidade, status, data"),
      supabase.from("evidencias_coleta_log").select("coletor, criado_em, quantidade_novas, quantidade_ignoradas_duplicadas, quantidade_erros").order("criado_em", { ascending: false }).limit(200),
    ]);
    if (erroEv || erroLogs) {
      erro = erroEv?.message ?? erroLogs?.message ?? "Falha ao ler a Memory Layer.";
    } else {
      resumo = resumirAuditoriaMemoria((evidencias ?? []) as LinhaEvidenciaAuditoria[], agora);
      resumoLogs = resumirLogsColeta(
        (logs ?? []).map((l) => ({
          coletor: l.coletor,
          criadoEm: l.criado_em,
          quantidadeNovas: l.quantidade_novas,
          quantidadeIgnoradasDuplicadas: l.quantidade_ignoradas_duplicadas,
          quantidadeErros: l.quantidade_erros,
        })) as LinhaLogColeta[]
      );
    }
  }

  return (
    <Shell ativo="/auditoria/memoria" titulo="Auditoria — Memory Layer">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <p className="text-[12px] text-slate-500">
          Quantidade de evidências coletadas, por empresa/categoria/origem/qualidade, e o histórico das execuções dos coletores. Corte honesto, não escondido: se um número aqui é zero, é porque nenhum coletor gravou nada ainda — não é erro de carregamento.
        </p>

        {erro && <p className="mt-6 rounded-lg border border-rose-500/20 bg-rose-500/5 p-4 text-[13px] text-rose-300">{erro}</p>}

        {resumo && (
          <>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Card titulo="Total de evidências" valor={resumo.total} />
              <Card titulo="Ativas" valor={resumo.ativas} />
              <Card titulo="Últimos 30 dias" valor={resumo.ultimos30dias} />
              <Card titulo="Empresas com evidência" valor={resumo.porEmpresa.length} />
            </div>

            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              <Tabela titulo="Por categoria" linhas={resumo.porCategoria.map((c) => [c.categoria, c.total])} />
              <Tabela titulo="Por origem" linhas={resumo.porOrigem.map((c) => [c.origem, c.total])} />
              <Tabela titulo="Por confiabilidade" linhas={resumo.porConfiabilidade.map((c) => [c.confiabilidade, c.total])} />
              <Tabela titulo="Top 10 empresas" linhas={resumo.porEmpresa.slice(0, 10).map((c) => [c.ticker, c.total])} />
            </div>
          </>
        )}

        {resumoLogs && (
          <div className="mt-8">
            <h2 className="text-[13px] font-semibold text-slate-300">Execuções dos coletores</h2>
            {resumoLogs.execucoesTotal === 0 ? (
              <p className="mt-2 text-[12px] text-slate-600">Nenhuma execução registrada ainda — rota /api/evidencias/coletar ainda não rodou em produção.</p>
            ) : (
              <table className="mt-2 w-full text-[12px]">
                <thead>
                  <tr className="text-left text-slate-500">
                    <th className="pb-1 pr-3">Coletor</th>
                    <th className="pb-1 pr-3">Execuções</th>
                    <th className="pb-1 pr-3">Novas</th>
                    <th className="pb-1 pr-3">Duplicadas</th>
                    <th className="pb-1 pr-3">Erros</th>
                    <th className="pb-1">Última execução</th>
                  </tr>
                </thead>
                <tbody>
                  {resumoLogs.porColetor.map((c) => (
                    <tr key={c.coletor} className="border-t border-white/5 text-slate-300">
                      <td className="py-1.5 pr-3">{c.coletor}</td>
                      <td className="py-1.5 pr-3">{c.execucoes}</td>
                      <td className="py-1.5 pr-3">{c.novas}</td>
                      <td className="py-1.5 pr-3">{c.duplicadas}</td>
                      <td className={`py-1.5 pr-3 ${c.erros > 0 ? "text-rose-400" : ""}`}>{c.erros}</td>
                      <td className="py-1.5 text-slate-500">{new Date(c.ultimaExecucao).toLocaleString("pt-BR")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

function Card({ titulo, valor }: { titulo: string; valor: number }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{titulo}</p>
      <p className="mt-1 text-xl font-semibold text-slate-100">{valor}</p>
    </div>
  );
}

function Tabela({ titulo, linhas }: { titulo: string; linhas: [string, number][] }) {
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
      <p className="text-[10px] uppercase tracking-wider text-slate-600">{titulo}</p>
      {linhas.length === 0 ? (
        <p className="mt-2 text-[12px] text-slate-600">Sem dados.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {linhas.map(([nome, total]) => (
            <li key={nome} className="flex justify-between text-[12px] text-slate-300">
              <span>{nome}</span>
              <span className="text-slate-500">{total}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
