/**
 * Sparkline de preço (SVG renderizado no servidor, sem JS no cliente).
 * Acende sozinho quando houver 5+ pregões coletados; antes disso mostra
 * um traço discreto — o sistema nunca desenha tendência com dado de menos.
 */
export function Sparkline({ valores }: { valores: number[] }) {
  const W = 84;
  const H = 24;
  const PAD = 2;

  if (valores.length < 5) {
    return (
      <span
        className="text-[10px] text-slate-600"
        title={`Gráfico aparece com 5 pregões coletados (temos ${valores.length}).`}
      >
        {valores.length}/5 pregões
      </span>
    );
  }

  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const faixa = max - min || 1;
  const passo = (W - PAD * 2) / (valores.length - 1);
  const pts = valores.map((v, i) => {
    const x = PAD + i * passo;
    const y = H - PAD - ((v - min) / faixa) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const subiu = valores[valores.length - 1] >= valores[0];
  const cor = subiu ? "#34d399" : "#f87171"; // emerald-400 / red-400 (mesma régua da coluna Dia)
  const [fimX, fimY] = pts[pts.length - 1].split(",").map(Number);

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Preço dos últimos ${valores.length} pregões, ${subiu ? "em alta" : "em queda"} no período`}
      className="inline-block align-middle"
    >
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={cor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.9"
      />
      <circle cx={fimX} cy={fimY} r="2" fill={cor} />
    </svg>
  );
}
