import Link from "next/link";
import { redirect } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

/** Busca global de empresas (barra superior). Acha por ticker ou nome;
 *  resultado único com tese aberta vai direto para a tese. */

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default async function Buscar({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const termo = (q ?? "").trim();

  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/buscar" titulo="Buscar" rolagem>
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const [{ data: empresasRaw }, { data: tesesRaw }] = await Promise.all([
    supabase.from("empresas").select("ticker, nome, setor").eq("ativo", true),
    supabase.from("teses").select("ticker").eq("ativa", true),
  ]);
  const comTese = new Set(
    (((tesesRaw as { ticker: string }[]) ?? [])).map((t) => t.ticker)
  );
  const empresas = ((empresasRaw as { ticker: string; nome: string; setor: string | null }[]) ?? [])
    .filter((e) => {
      if (!termo) return true;
      const t = normalizar(termo);
      return normalizar(e.ticker).includes(t) || normalizar(e.nome).includes(t);
    })
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  // um único resultado com tese: vai direto
  if (termo && empresas.length === 1 && comTese.has(empresas[0].ticker)) {
    redirect(`/tese/${empresas[0].ticker}`);
  }

  return (
    <Shell
      ativo="/buscar"
      titulo={termo ? `Busca: "${termo}"` : "Buscar empresa"}
      subtitulo={`${empresas.length} resultado${empresas.length === 1 ? "" : "s"} no universo de 40 empresas`}
      rolagem
    >
      <div className="max-w-2xl space-y-1.5">
        {empresas.map((e) => (
          <Link
            key={e.ticker}
            href={comTese.has(e.ticker) ? `/tese/${e.ticker}` : `/radar`}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-2.5 transition-colors hover:border-sky-400/30"
          >
            <span>
              <span className="font-mono font-semibold">{e.ticker}</span>
              <span className="ml-3 text-slate-400">{e.nome}</span>
              {e.setor && <span className="ml-2 text-[11px] text-slate-600">· {e.setor}</span>}
            </span>
            {comTese.has(e.ticker) ? (
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                tese ativa
              </span>
            ) : (
              <span className="text-[10px] text-slate-600">no Radar →</span>
            )}
          </Link>
        ))}
        {empresas.length === 0 && (
          <p className="text-sm text-slate-500">
            Nada encontrado no universo atual. O universo tem 40 empresas — a
            expansão passa pelo Radar e pelo backfill da CVM.
          </p>
        )}
      </div>
    </Shell>
  );
}
