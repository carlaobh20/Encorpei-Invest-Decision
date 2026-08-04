import type { CoachInsight } from "@/lib/coach-insights";

/**
 * INVESTMENT COACH — componente reutilizável (Bloco 2, Sprint 2.7).
 *
 * "Nunca em excesso. No máximo um insight principal por tela." — quem
 * decide SE existe insight é `gerarCoachInsight` (coach-insights.ts, regra
 * pura); este componente só desenha o que recebeu. `insight === null`
 * renderiza nada — nunca um placeholder tipo "sem insight hoje", que
 * competiria com a informação principal da tela por espaço à toa.
 *
 * Visual deliberadamente discreto (ícone + pouco texto), pra nunca
 * competir com o dado principal — mesmo espírito de discrição do
 * PorQueComoCalculamos.tsx (Sprint 2.5), só que sempre visível (não é um
 * `<details>`) porque é UM insight só, não uma lista de auditoria.
 */
export function InvestmentCoach({ insight }: { insight: CoachInsight | null }) {
  if (!insight) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-[14px] border border-violet-500/20 bg-violet-500/[0.06] p-3">
      <span aria-hidden className="mt-0.5 shrink-0 text-[14px]">🧭</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300">Coach Insight · {insight.titulo}</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-300">{insight.texto}</p>
      </div>
    </div>
  );
}
