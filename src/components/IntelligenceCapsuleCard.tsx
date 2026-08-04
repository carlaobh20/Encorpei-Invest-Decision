import type { IntelligenceCapsule, NivelConfianca } from "@/lib/intelligence-capsule";

/**
 * INTELLIGENCE CAPSULE — componente reutilizável (Bloco 2, Sprint 2.7).
 *
 * Estrutura fixa da spec: Resumo → Por que importa → Maior oportunidade →
 * Maior risco → Nível de confiança → Preciso agir? Componente puro de
 * apresentação — toda a lógica está em `montarIntelligenceCapsule`
 * (intelligence-capsule.ts).
 */

const ROTULO_CONFIANCA: Record<NivelConfianca, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
  indisponivel: "Sem verificação hoje",
};

const COR_CONFIANCA: Record<NivelConfianca, string> = {
  alta: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
  media: "text-amber-300 bg-amber-500/10 border-amber-500/30",
  baixa: "text-red-300 bg-red-500/10 border-red-500/30",
  indisponivel: "text-slate-500 bg-white/[0.03] border-white/10",
};

export function IntelligenceCapsuleCard({ capsula }: { capsula: IntelligenceCapsule }) {
  return (
    <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.02] p-3.5 text-[11.5px] leading-relaxed text-slate-300">
      <p className="text-[9px] uppercase tracking-wider text-slate-500">Resumo</p>
      <p>{capsula.resumo}</p>
      <p className="mt-2 text-[9px] uppercase tracking-wider text-slate-500">Por que importa</p>
      <p>{capsula.porQueImporta}</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">Maior oportunidade</p>
          <p>{capsula.maiorOportunidade}</p>
        </div>
        <div>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">Maior risco</p>
          <p>{capsula.maiorRisco}</p>
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${COR_CONFIANCA[capsula.nivelConfianca]}`}>
          Confiança: {ROTULO_CONFIANCA[capsula.nivelConfianca]}
        </span>
        <span className={`rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${capsula.precisoAgir ? "text-amber-300 bg-amber-500/10 border-amber-500/30" : "text-slate-400 bg-white/[0.03] border-white/10"}`}>
          {capsula.precisoAgir ? "Precisa de decisão" : "Sem ação necessária"}
        </span>
      </div>
      <p className="mt-1.5 text-[9.5px] text-slate-600">{capsula.precisoAgirMotivo}</p>
    </div>
  );
}
