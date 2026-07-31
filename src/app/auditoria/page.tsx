import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type LinhaAuditoria = {
  ticker: string;
  nome: string;
  setor: string | null;
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
    (Date.now() - new Date(ultimoPreco + "T12:00:00-03:00").getTime()) /
    86_400_000;
  return dias > 4; // mais de 4 dias sem preço = atraso (cobre fins de semana)
}

export default async function Auditoria() {
  let linhas: LinhaAuditoria[] = [];
  let erro: string | null = null;

  if (!isSupabaseConfigured || !supabase) {
    erro = "Supabase ainda não configurado (variáveis de ambiente ausentes).";
  } else {
    const { data, error } = await supabase
      .from("auditoria_dados")
      .select("*")
      .order("ticker");
    if (error) erro = error.message;
    else linhas = (data as LinhaAuditoria[]) ?? [];
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-400">
          Fase 1 · Pipeline de dados
        </p>
        <h1 className="mt-2 text-3xl font-bold">Auditoria de dados</h1>
        <p className="mt-2 text-sm text-slate-400">
          Última data coletada por empresa. Linha vermelha = dado atrasado.
          Sem dado confiável aqui, nenhum score lá na frente vale nada.
        </p>

        {erro ? (
          <div className="mt-8 rounded-xl border border-amber-700 bg-amber-950/40 p-4 text-amber-300">
            {erro}
          </div>
        ) : (
          <table className="mt-8 w-full text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-left text-slate-500">
                <th className="py-2 pr-4">Ticker</th>
                <th className="py-2 pr-4">Empresa</th>
                <th className="py-2 pr-4">Setor</th>
                <th className="py-2 pr-4">Último preço</th>
                <th className="py-2 pr-4">Dias coletados</th>
                <th className="py-2">Último trimestre</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr
                  key={l.ticker}
                  className={`border-b border-slate-900 ${
                    atrasado(l.ultimo_preco) ? "text-red-400" : ""
                  }`}
                >
                  <td className="py-2 pr-4 font-mono">{l.ticker}</td>
                  <td className="py-2 pr-4">{l.nome}</td>
                  <td className="py-2 pr-4 text-slate-400">{l.setor ?? "—"}</td>
                  <td className="py-2 pr-4">{fmt(l.ultimo_preco)}</td>
                  <td className="py-2 pr-4">{l.dias_coletados}</td>
                  <td className="py-2">{fmt(l.ultimo_trimestre)}</td>
                </tr>
              ))}
              {linhas.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-slate-500">
                    Nenhuma empresa cadastrada ainda — rode a migração 001 no
                    Supabase.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
