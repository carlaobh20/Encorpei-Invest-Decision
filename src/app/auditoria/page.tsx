import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";

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

  if (!isSupabaseConfigured || !supabase) {
    erro = "Supabase não configurado.";
  } else {
    const { data, error } = await supabase
      .from("auditoria_dados")
      .select("*")
      .order("ticker");
    if (error) erro = error.message;
    else linhas = (data as LinhaAuditoria[]) ?? [];
  }

  const atrasadas = linhas.filter((l) => atrasado(l.ultimo_preco)).length;

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
      </div>

      {erro && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-300">
          {erro}
        </div>
      )}

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
