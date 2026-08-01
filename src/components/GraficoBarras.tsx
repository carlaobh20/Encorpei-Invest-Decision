/**
 * Gráfico de barras (SVG, server-rendered) no padrão do skill de dataviz:
 * marcas finas, topo arredondado, vão de 2px entre barras, eixo recessivo,
 * rótulo direto só no último ponto, tooltip nativo por barra, um eixo só.
 * Paleta categórica validada (dark): #059669 / #0284c7 / #d97706.
 */

export type SerieBarras = {
  nome: string;
  cor: string;
  pontos: { rotulo: string; valor: number | null }[];
};

function fmtCurto(v: number, formato: "percentual" | "reais"): string {
  if (formato === "percentual")
    return `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
  const abs = Math.abs(v);
  if (abs >= 1e9)
    return `R$ ${(v / 1e9).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} bi`;
  if (abs >= 1e6)
    return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mi`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

export function GraficoBarras({
  titulo,
  formato,
  series,
  altura = 96,
}: {
  titulo: string;
  formato: "percentual" | "reais";
  series: SerieBarras[];
  altura?: number;
}) {
  const rotulos = series[0]?.pontos.map((p) => p.rotulo) ?? [];
  const valores = series.flatMap((s) =>
    s.pontos.map((p) => p.valor).filter((v): v is number => v !== null)
  );
  if (rotulos.length === 0 || valores.length === 0) {
    return (
      <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{titulo}</p>
        <p className="mt-2 text-xs text-slate-600">sem dados suficientes</p>
      </div>
    );
  }

  const max = Math.max(...valores, 0);
  const min = Math.min(...valores, 0);
  const amplitude = max - min || 1;

  const W = 100; // viewBox lógico
  const H = altura;
  const grupoW = W / rotulos.length;
  const barGap = 2; // px lógicos entre barras do grupo
  const barW = Math.max(2, (grupoW - barGap * (series.length + 1)) / series.length);
  const zeroY = (max / amplitude) * (H - 18) + 4; // linha do zero

  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">{titulo}</p>
        {series.length === 1 && series[0].pontos.at(-1)?.valor !== null && (
          <p className="text-[11px] font-semibold text-slate-300">
            {fmtCurto(series[0].pontos.at(-1)!.valor!, formato)}
          </p>
        )}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-1 w-full" style={{ height: altura }}>
        {/* linha do zero (eixo recessivo) */}
        <line x1="0" x2={W} y1={zeroY} y2={zeroY} stroke="rgba(255,255,255,0.12)" strokeWidth="0.5" />
        {rotulos.map((rot, i) => (
          <g key={rot}>
            {series.map((s, j) => {
              const v = s.pontos[i]?.valor;
              if (v === null || v === undefined) return null;
              const hBar = (Math.abs(v) / amplitude) * (H - 18);
              const x = i * grupoW + barGap * (j + 1) + barW * j;
              const y = v >= 0 ? zeroY - hBar : zeroY;
              return (
                <rect
                  key={s.nome}
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(hBar, 0.5)}
                  rx="1"
                  fill={s.cor}
                  opacity={v < 0 ? 0.75 : 1}
                >
                  <title>{`${s.nome} · ${rot}: ${fmtCurto(v, formato)}`}</title>
                </rect>
              );
            })}
            <text
              x={i * grupoW + grupoW / 2}
              y={H - 2}
              textAnchor="middle"
              fontSize="4.4"
              fill="rgba(148,163,184,0.7)"
            >
              {rot}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** rótulo curto de competência: 2026-03-31 → 1T26 */
export function rotuloTrimestre(competencia: string): string {
  const [ano, mes] = competencia.split("-");
  const tri = { "03": "1T", "06": "2T", "09": "3T", "12": "4T" }[mes] ?? mes;
  return `${tri}${ano.slice(2)}`;
}

export const CORES_COMPARADOR = ["#059669", "#0284c7", "#d97706"];
