import Link from "next/link";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { Shell } from "@/components/Shell";
import { calcularRadar, candidatas } from "@/lib/radar";
import { ROTULO_MODELO } from "@/lib/setores";

export const dynamic = "force-dynamic";

/**
 * RADAR — onde procurar a PRÓXIMA tese. Prévia das 40 empresas pelas
 * réguas versionadas v1 (cálculo em src/lib/radar.ts, compartilhado com o
 * Decision Center). Nada aqui é recomendação de compra ou venda.
 */

function corNota(n: number): string {
  if (n >= 80) return "text-emerald-300";
  if (n >= 60) return "text-emerald-500";
  if (n >= 40) return "text-amber-400";
  return "text-red-400";
}
const pct = (v: number | null) =>
  v === null ? "—" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

export default async function Radar() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/radar" titulo="Radar">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const linhas = await calcularRadar(supabase);
  const top = candidatas(linhas, 3);

  return (
    <Shell
      ativo="/radar"
      titulo="Radar"
      subtitulo="As 40 empresas do universo avaliadas pelas MESMAS réguas versionadas do algoritmo — prévia calculada na hora, com dados oficiais. É aqui que se procura a próxima tese."
    >
      {top.length > 0 && (
        <div className="flex gap-3">
          {top.map((c, i) => (
            <div
              key={c.ticker}
              className="flex-1 rounded-2xl border border-sky-400/20 bg-sky-500/[0.06] px-4 py-3"
            >
              <p className="text-[10px] uppercase tracking-[0.25em] text-sky-300/80">
                candidata a tese nº {i + 1}
              </p>
              <p className="mt-0.5 text-base font-bold">
                <span className="font-mono">{c.ticker}</span>{" "}
                <span className={corNota(c.nota)}>{c.nota}</span>
                <span className="ml-2 text-xs font-normal text-slate-400">{c.nome}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                ROIC {pct(c.roic4)} · margem {pct(c.margem)} ·{" "}
                {c.caixaLiquido ? "caixa líquido" : `dívida ${pct(c.alav)} do patrimônio`}
                {c.pl !== null && <> · preço/lucro {c.pl.toFixed(1)}×</>}
              </p>
            </div>
          ))}
        </div>
      )}

      <section className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            Universo completo — prévia pelas réguas v1
          </h2>
          <p className="text-[10px] text-slate-600">
            prévia ≠ nota oficial · sem recomendação de compra ou venda
          </p>
        </div>
        <div className="mt-2 min-h-0 flex-1 overflow-y-auto pr-1">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-slate-950/90 backdrop-blur">
              <tr className="text-left text-[10px] uppercase tracking-wider text-slate-600">
                <th className="py-1.5 pr-2">Empresa</th>
                <th className="py-1.5 pr-2">Situação</th>
                <th className="py-1.5 pr-2 text-right">ROIC 4tri</th>
                <th className="py-1.5 pr-2 text-right">Margem</th>
                <th className="py-1.5 pr-2 text-right">Dív/Patr</th>
                <th className="py-1.5 pr-2 text-right">P/L</th>
                <th className="py-1.5 pr-2 text-right">Carrego*</th>
                <th className="py-1.5 pr-2 text-right">Confiança</th>
                <th className="py-1.5 text-right">Prévia</th>
              </tr>
            </thead>
            <tbody>
              {linhas.map((l) => (
                <tr key={l.ticker} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="py-1.5 pr-2">
                    {l.temTese ? (
                      <Link href={`/tese/${l.ticker}`} className="hover:underline">
                        <span className="font-mono font-semibold">{l.ticker}</span>
                        <span className="ml-2 text-slate-400">{l.nome}</span>
                      </Link>
                    ) : (
                      <>
                        <span className="font-mono font-semibold">{l.ticker}</span>
                        <span className="ml-2 text-slate-400">{l.nome}</span>
                      </>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    <span className="mr-1 rounded-full border border-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-slate-500">
                      {l.modelo ? ROTULO_MODELO[l.modelo] : "—"}
                    </span>
                    {l.melhorDoSetor && (
                      <span className="mr-1 rounded-full border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-sky-300" title="maior prévia dentro do seu modelo de negócio">
                        nº1 do setor
                      </span>
                    )}
                    {l.temTese ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-300">
                        tese ativa
                      </span>
                    ) : (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-slate-500">
                        sem tese
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{pct(l.roic4)}</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-300">{pct(l.margem)}</td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                    {l.caixaLiquido ? <span className="text-emerald-400">caixa</span> : pct(l.alav)}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-slate-300">
                    {l.pl !== null ? `${l.pl.toFixed(1)}×` : "—"}
                  </td>
                  <td className="py-1.5 pr-2 text-right font-mono text-sky-300/90">
                    {l.carryReal !== null ? (
                      <Link
                        href={`/auditoria/carry/${l.ticker}`}
                        className="hover:underline"
                        title="Como foi calculado"
                      >
                        IPCA+{(l.carryReal * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1.5 pr-2 text-right text-[11px] text-slate-500">{l.confianca}</td>
                  <td className={`py-1.5 text-right text-sm font-bold ${corNota(l.nota)}`}>
                    {l.componentes > 0 ? l.nota : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[10.5px] leading-snug text-slate-600">
          Como ler: a prévia usa as mesmas réguas da nota oficial (qualidade, valuation e risco,
          pesos v1). *Carrego = estimativa de PISO do Carry Engine v1 (lucro 12m ÷ preço, cenário
          sem crescimento) — estimativa baseada nos fundamentos atuais, nunca retorno garantido.
          Bancos e seguradoras aparecem com confiança menor — ROIC e dívida não se aplicam ao
          modelo deles e o sistema não finge que se aplicam. Empresa boa aqui é convite para
          ESTUDAR e, se convencer, virar tese — nunca ordem de compra.
        </p>
      </section>
    </Shell>
  );
}
