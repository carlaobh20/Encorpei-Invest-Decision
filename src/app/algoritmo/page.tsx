import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

type Versao = {
  versao: number;
  descricao: string;
  pesos: Record<string, number>;
  regras: Record<string, unknown>;
  criado_em: string;
};

export default async function Algoritmo() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/algoritmo" titulo="Algoritmo">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const { data } = await supabase
    .from("versao_algoritmo")
    .select("versao, descricao, pesos, regras, criado_em")
    .order("versao", { ascending: false });
  const versoes = (data as Versao[]) ?? [];

  return (
    <Shell
      ativo="/algoritmo"
      titulo="O Algoritmo, aberto"
      subtitulo="Compromisso de fundação: nunca usar caixa-preta. Toda régua que gera nota está aqui, versionada — mudou um peso, nasce uma versão nova e a antiga fica registrada para sempre."
    >
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {versoes.map((v, i) => (
          <section key={v.versao} className="rounded-2xl border border-white/5 bg-white/[0.03] p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">
                Versão {v.versao}
                {i === 0 && (
                  <span className="ml-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                    VIGENTE
                  </span>
                )}
              </h2>
              <span className="text-[11px] text-slate-500">
                desde {new Date(v.criado_em).toLocaleDateString("pt-BR")}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-relaxed text-slate-300">{v.descricao}</p>

            <h3 className="mt-4 text-[11px] uppercase tracking-[0.25em] text-slate-500">
              Pesos da nota final
            </h3>
            <div className="mt-2 flex gap-3">
              {Object.entries(v.pesos).map(([nome, peso]) => (
                <div key={nome} className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-2 text-center">
                  <p className="text-lg font-bold text-emerald-300">{Math.round(peso * 100)}%</p>
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">{nome}</p>
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-slate-600">
              Quando um componente não tem dado (ex.: valuation sem valor de
              mercado), os pesos são redistribuídos entre os presentes e a
              confiança da nota cai — o sistema nunca inventa o que não sabe.
            </p>

            <h3 className="mt-4 text-[11px] uppercase tracking-[0.25em] text-slate-500">
              Réguas de pontuação
            </h3>
            <pre className="mt-2 overflow-x-auto rounded-xl bg-black/30 p-4 text-[11px] leading-relaxed text-slate-300">
{JSON.stringify(v.regras, null, 2)}
            </pre>
          </section>
        ))}
        {versoes.length === 0 && <p className="text-slate-500">Nenhuma versão registrada.</p>}
      </div>
    </Shell>
  );
}
