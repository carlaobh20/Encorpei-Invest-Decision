"use client";

import { useEffect, useMemo, useState } from "react";
import type { PontoPatrimonio } from "@/lib/patrimonio";

/**
 * Gráfico principal do "Meu Patrimônio" — carteira vs. CDI/Ibovespa/IPCA,
 * SVG puro (sem lib de charting) desenhado a partir dos `pontos` que
 * calcularPatrimonio() já entrega. Nunca recalcula nada: só filtra por
 * período, escala e desenha o que já veio do motor real.
 *
 * Corte honesto: se o período escolhido não tiver pontos suficientes,
 * cai de volta para a série inteira em vez de desenhar um gráfico vazio;
 * uma série (CDI/IPCA/Ibovespa) que esteja null nos pontos visíveis
 * simplesmente não desenha linha para ela nesse trecho — nunca interpola
 * um valor que o motor não calculou.
 *
 * Eixo Y = rentabilidade acumulada DESDE O INÍCIO DO PERÍODO VISÍVEL, não
 * valor absoluto em R$ (04/08/2026: Carlos pegou a Carteira mostrando
 * +6,7% no 1M mas desenhada ABAIXO do CDI +1,1% — os dois simulam o mesmo
 * capital aportado, então em R$ absoluto a Carteira pode estar "atrás" do
 * CDI olhando desde sempre, mesmo tendo subido mais SÓ no último mês. Cada
 * linha agora reparte do zero no primeiro ponto visível do período
 * escolhido (mesma conta de `rentAcumulada`, reusada pra desenhar a linha
 * também) — a posição vertical passa a bater com o rótulo de % embaixo.
 *
 * Aspect ratio do viewBox (reconstrução "terminal financeiro", 03/08/2026):
 * o card do gráfico na home agora tem ~280-320px de altura total (era
 * livre antes) — como o SVG escala por `viewBox` num `<div>` com `w-full`,
 * a altura renderizada é sempre `largura_do_container × (H/W)`. H foi
 * reduzido de 300 para 230 (W continua 900, ~3,9:1 em vez de 3:1) para que,
 * numa coluna de 70% de largura de um monitor comum, a área plotada em si
 * fique perto de 280-320px já contando as barras de período/legenda acima
 * e o resumo de rentabilidade abaixo.
 */

type Serie = "valorCarteira" | "cdiSimulado" | "ipcaSimulado" | "ibovespaSimulado";

const SERIES: { chave: Serie; rotulo: string; cor: string; largura: number; opacidade: number }[] = [
  { chave: "valorCarteira", rotulo: "Carteira", cor: "#22e0a6", largura: 2.5, opacidade: 1 },
  { chave: "cdiSimulado", rotulo: "CDI", cor: "#38bdf8", largura: 1.5, opacidade: 0.85 },
  { chave: "ibovespaSimulado", rotulo: "Ibovespa", cor: "#facc15", largura: 1.5, opacidade: 0.85 },
  { chave: "ipcaSimulado", rotulo: "IPCA", cor: "#94a3b8", largura: 1.5, opacidade: 0.7 },
];

const PERIODOS: { rotulo: string; meses: number | null }[] = [
  { rotulo: "1M", meses: 1 },
  { rotulo: "3M", meses: 3 },
  { rotulo: "6M", meses: 6 },
  { rotulo: "12M", meses: 12 },
  { rotulo: "24M", meses: 24 },
  { rotulo: "5A", meses: 60 },
  { rotulo: "Desde o início", meses: null },
];

const W = 900;
const H = 230;
const PADX = 4;
const PADY = 12;

function subtrairMeses(dataISO: string, meses: number): string {
  const d = new Date(dataISO + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() - meses);
  return d.toISOString().slice(0, 10);
}

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pctFmt = (v: number) =>
  `${v >= 0 ? "+" : ""}${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const fmtData = (d: string) =>
  new Date(d + "T00:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export function GraficoPatrimonio({ pontos }: { pontos: PontoPatrimonio[] }) {
  const [periodo, setPeriodo] = useState(PERIODOS[PERIODOS.length - 1]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useEffect(() => {
    setHoverIdx(null);
  }, [periodo]);

  const filtrados = useMemo(() => {
    if (pontos.length === 0) return [];
    if (periodo.meses === null) return pontos;
    const ultimaData = pontos[pontos.length - 1].data;
    const corte = subtrairMeses(ultimaData, periodo.meses);
    const f = pontos.filter((p) => p.data >= corte);
    // corte honesto: período pedido sem 2+ pontos → volta pra série inteira
    // em vez de desenhar um gráfico vazio ou enganosamente plano
    return f.length >= 2 ? f : pontos;
  }, [pontos, periodo]);

  const n = filtrados.length;

  // Rentabilidade acumulada de uma série DESDE O PRIMEIRO PONTO VISÍVEL do
  // período filtrado — base é o primeiro valor não-nulo dentro de
  // `filtrados` (não necessariamente o índice 0: uma série com histórico
  // mais curto, ex. Ibovespa, começa de onde ela de fato tem dado real).
  // Usada tanto pro rótulo de % quanto pra posição Y da linha no gráfico —
  // uma única conta, nunca duas contas que podem divergir.
  function rentAcumulada(chave: Serie, ateIdx: number): number | null {
    if (ateIdx < 0 || ateIdx >= filtrados.length) return null;
    const primeiro = filtrados.find((p) => p[chave] !== null);
    if (!primeiro) return null;
    const base = primeiro[chave] as number;
    const atual = filtrados[ateIdx][chave];
    if (atual === null || base <= 0) return null;
    return atual / base - 1;
  }

  const { min, max } = useMemo(() => {
    let mn = Infinity;
    let mx = -Infinity;
    filtrados.forEach((_, i) => {
      for (const s of SERIES) {
        const v = rentAcumulada(s.chave, i);
        if (v !== null) {
          if (v < mn) mn = v;
          if (v > mx) mx = v;
        }
      }
    });
    if (!Number.isFinite(mn) || !Number.isFinite(mx)) return { min: 0, max: 1 };
    if (mn === mx) return { min: mn - 1, max: mx + 1 };
    return { min: mn, max: mx };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados]);

  const xAt = (i: number) => (n <= 1 ? PADX : PADX + (i * (W - 2 * PADX)) / (n - 1));
  const yAt = (v: number) => H - PADY - ((v - min) / (max - min)) * (H - 2 * PADY);

  function pathFor(chave: Serie): string {
    let d = "";
    let iniciado = false;
    filtrados.forEach((_, i) => {
      const v = rentAcumulada(chave, i);
      if (v === null) {
        iniciado = false;
        return;
      }
      const x = xAt(i);
      const y = yAt(v);
      d += `${iniciado ? "L" : "M"} ${x.toFixed(2)},${y.toFixed(2)} `;
      iniciado = true;
    });
    return d.trim();
  }

  function handleMove(e: React.MouseEvent<SVGSVGElement>) {
    if (n <= 1) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * W;
    const passo = (W - 2 * PADX) / (n - 1);
    let idx = Math.round((relX - PADX) / passo);
    idx = Math.max(0, Math.min(n - 1, idx));
    setHoverIdx(idx);
  }

  const hoverX = hoverIdx !== null ? xAt(hoverIdx) : null;
  const tooltipEsquerda = hoverX !== null ? (hoverX / W) * 100 : 0;
  const tooltipInverte = hoverX !== null && hoverX > W * 0.62;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1">
          {PERIODOS.map((p) => (
            <button
              key={p.rotulo}
              type="button"
              onClick={() => setPeriodo(p)}
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                p.rotulo === periodo.rotulo
                  ? "bg-emerald-400/15 text-emerald-200"
                  : "text-slate-500 hover:bg-white/[0.04] hover:text-slate-300"
              }`}
            >
              {p.rotulo}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-4 text-[10.5px] text-slate-500">
          {SERIES.map((s) => (
            <span key={s.chave} className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.cor }} />
              {s.rotulo}
            </span>
          ))}
        </div>
      </div>

      {n < 2 ? (
        <p className="mt-10 text-sm text-slate-500">
          Série ainda curta para desenhar o gráfico — acumula um ponto por pregão desde a data de compra mais
          antiga registrada. Volte quando houver 2 ou mais pregões.
        </p>
      ) : (
        <div className="relative mt-2">
          <svg
            key={periodo.rotulo}
            viewBox={`0 0 ${W} ${H}`}
            className="w-full touch-none"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
            role="img"
            aria-label="Evolução do patrimônio comparado a CDI, Ibovespa e IPCA"
          >
            <style>{`
              @keyframes grafico-patrimonio-entrada {
                from { stroke-dashoffset: 1; }
                to { stroke-dashoffset: 0; }
              }
              .gp-linha {
                stroke-dasharray: 1;
                stroke-dashoffset: 1;
                animation: grafico-patrimonio-entrada 1.15s cubic-bezier(0.22, 1, 0.36, 1) forwards;
              }
            `}</style>

            {/* linhas de grade horizontais discretas */}
            {[0.25, 0.5, 0.75].map((f) => (
              <line
                key={f}
                x1={PADX}
                x2={W - PADX}
                y1={PADY + f * (H - 2 * PADY)}
                y2={PADY + f * (H - 2 * PADY)}
                stroke="rgba(255,255,255,0.04)"
                strokeWidth={1}
              />
            ))}

            {hoverX !== null && (
              <line x1={hoverX} x2={hoverX} y1={PADY} y2={H - PADY} stroke="rgba(255,255,255,0.14)" strokeWidth={1} />
            )}

            {SERIES.map((s) => (
              <path
                key={s.chave}
                d={pathFor(s.chave)}
                fill="none"
                stroke={s.cor}
                strokeWidth={s.largura}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={s.opacidade}
                pathLength={1}
                className="gp-linha"
              />
            ))}

            {hoverIdx !== null &&
              SERIES.map((s) => {
                const v = rentAcumulada(s.chave, hoverIdx);
                if (v === null) return null;
                return <circle key={s.chave} cx={xAt(hoverIdx)} cy={yAt(v)} r={3} fill={s.cor} />;
              })}
          </svg>

          {hoverIdx !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 min-w-[168px] rounded-xl border border-white/10 bg-[#0b1a2a]/95 px-3 py-2.5 text-[11px] shadow-2xl backdrop-blur"
              style={{
                left: `${tooltipEsquerda}%`,
                transform: tooltipInverte ? "translateX(-104%)" : "translateX(8px)",
              }}
            >
              <p className="text-[10px] uppercase tracking-wider text-slate-500">{fmtData(filtrados[hoverIdx].data)}</p>
              <div className="mt-1.5 space-y-1">
                {SERIES.map((s) => {
                  const v = filtrados[hoverIdx][s.chave];
                  const r = rentAcumulada(s.chave, hoverIdx);
                  return (
                    <p key={s.chave} className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: s.cor }} />
                      <span className="text-slate-400">{s.rotulo}</span>
                      <span className="ml-auto font-mono text-slate-100">{v !== null ? brl(v) : "—"}</span>
                      {r !== null && (
                        <span className={`ml-1 font-mono text-[10px] ${r >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                          {pctFmt(r)}
                        </span>
                      )}
                    </p>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 border-t border-white/5 pt-2">
        {SERIES.map((s) => {
          const r = n >= 2 ? rentAcumulada(s.chave, n - 1) : null;
          return (
            <div key={s.chave}>
              <p
                className={`font-mono text-[13px] font-semibold ${
                  r === null ? "text-slate-600" : r >= 0 ? "text-emerald-400" : "text-red-400"
                }`}
              >
                {r !== null ? pctFmt(r) : "—"}
              </p>
              <p className="text-[9px] uppercase tracking-wider text-slate-500">
                {s.rotulo} · {periodo.rotulo}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
