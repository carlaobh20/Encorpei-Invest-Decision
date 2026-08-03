import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { calcularRadar } from "@/lib/radar";
import { ROTULO_MODELO } from "@/lib/setores";

export const dynamic = "force-dynamic";

/**
 * AUDIT MODE do Carry — "como foi calculado", por empresa.
 * Regra 6 do FDIE: fórmula, valores usados, fonte e resultado, sempre
 * visíveis lado a lado. Reaproveita EXATAMENTE o mesmo cálculo do Radar
 * (src/lib/radar.ts) — nunca um número paralelo "só para mostrar bonito".
 */

const fmt = (v: number | null) => (v === null ? "—" : v.toLocaleString("pt-BR", { maximumFractionDigits: 0 }));
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`);

export default async function AuditCarry({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const tk = ticker.toUpperCase();

  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/auditoria" titulo="Como foi calculado">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const linhas = await calcularRadar(supabase);
  const l = linhas.find((x) => x.ticker === tk);
  if (!l) notFound();

  return (
    <Shell
      ativo="/auditoria"
      titulo={`Como foi calculado — Carrego (${l.ticker})`}
      subtitulo="Fórmula, valores usados e fonte. Nada aqui é opinião — é aritmética sobre dado oficial."
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          <span className="font-mono font-semibold text-slate-100">{l.ticker}</span>
          <span className="ml-2">{l.nome}</span>
          <span className="ml-2 rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
            {l.modelo ? ROTULO_MODELO[l.modelo] : "sem modelo"}
          </span>
        </p>
        <Link href="/radar" className="text-[12px] text-sky-400 hover:underline">
          ← voltar ao Radar
        </Link>
      </div>

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Resultado</h2>
        <p className="mt-2 text-2xl font-bold text-sky-300">
          {l.carryReal !== null ? `IPCA + ${pct(l.carryReal)} a.a.` : "Incalculável"}
        </p>
        <p className="mt-1 text-[12.5px] text-slate-400">
          Confiança: <span className="text-slate-300">{l.carryConfianca}</span> · Carry Engine v{l.carryVersao} (
          {l.carryMetodo})
        </p>
        <p className="mt-2 text-[12.5px] leading-relaxed text-slate-300">{l.carryExplicacao}</p>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Fórmula</h2>
        <div className="mt-2 rounded-xl border border-white/10 bg-black/30 p-3 font-mono text-[12.5px] text-slate-300">
          <p>carry_piso = lucro_LTM ÷ valor_de_mercado</p>
          <p className="mt-1 text-slate-500">
            {"// v2 (quando payout/ROIC disponíveis): carry = (piso × payout) + (retenção × ROIC médio 4tri)"}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Valores usados</h2>
        <table className="mt-2 w-full text-[12.5px]">
          <tbody>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-slate-500">Lucro dos últimos 12 meses (LTM)</td>
              <td className="py-1.5 text-right font-mono text-slate-200">{fmt(l.carryLucroLtm)}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-slate-500">Valor de mercado (cotação × ações, ou fonte bruta)</td>
              <td className="py-1.5 text-right font-mono text-slate-200">{fmt(l.carryMarketCap)}</td>
            </tr>
            <tr className="border-t border-white/5">
              <td className="py-1.5 pr-3 text-slate-500">ROIC médio (4 trimestres)</td>
              <td className="py-1.5 text-right font-mono text-slate-200">{pct(l.roic4)}</td>
            </tr>
          </tbody>
        </table>
        <p className="mt-2 text-[11px] leading-snug text-slate-600">
          Fonte: Lucro LTM e ROIC vêm dos DFP/ITR mais recentes coletados da CVM (tabela fundamentos, colunas
          receita_liquida/lucro_liquido/roic); valor de mercado vem da cotação oficial mais recente (brapi/B3)
          × ações em circulação (CVM, composição de capital). Sem "página de PDF" para citar aqui: o pipeline
          lê os arquivos estruturados que a CVM publica, não escaneia documentos escaneados.
        </p>
      </section>

      {l.carryFatores.length > 0 && (
        <section className="rounded-2xl border border-white/5 bg-white/[0.03] p-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Fatores considerados</h2>
          <ul className="mt-2 space-y-1 text-[12.5px]">
            {l.carryFatores.map((f, i) => (
              <li key={i} className={f.direcao === "sustenta" ? "text-emerald-300/90" : "text-amber-300/90"}>
                {f.direcao === "sustenta" ? "✓ " : "⚠ "}
                {f.texto}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="text-[11px] text-slate-600">
        Estimativa baseada em fundamentos oficiais — nunca retorno garantido. Nada aqui é recomendação de
        compra ou venda.
      </p>
    </Shell>
  );
}
