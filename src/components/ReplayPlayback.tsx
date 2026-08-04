"use client";

import { useEffect, useState } from "react";

export type EventoReplayUI = { tipo: string; data: string; explicacao: string };

const ROTULO_TIPO: Record<string, string> = {
  novo_balanco: "Novo balanço",
  mudanca_nota: "Nota mudou",
  mudanca_carry: "Carry mudou",
  evento_tese: "Evento da tese",
  nova_versao_tese: "Nova versão da tese",
  resultado_observado: "Resultado observado",
};

function fmtData(d: string) {
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * "▶ Reproduzir evolução da tese" (Bloco 2 — Sprint 2.2, Empresas, Seção 11).
 * Único componente client desta tela — precisa de estado local (índice
 * corrente, play/pause). Não busca nem calcula nada: só percorre
 * cronologicamente a lista de eventos já montada por `thesis-replay-dados.ts`.
 */
export function ReplayPlayback({ eventos }: { eventos: EventoReplayUI[] }) {
  // eventos chegam do mais recente pro mais antigo (mesma ordem da timeline estática) — a reprodução percorre do mais ANTIGO pro mais recente, sentido cronológico real.
  const cronologico = [...eventos].reverse();
  const [indice, setIndice] = useState(0);
  const [tocando, setTocando] = useState(false);

  const podeAvancar = indice < cronologico.length - 1;

  // Só agenda o próximo passo quando realmente há pra onde avançar — nunca
  // chama setState síncrono dentro do efeito (react-hooks/purity); quando
  // chega no fim, o efeito simplesmente não agenda mais nada e o botão
  // some sozinho (calculado direto do render, não de outro setState).
  useEffect(() => {
    if (!tocando || !podeAvancar) return;
    const id = setTimeout(() => setIndice((i) => Math.min(i + 1, cronologico.length - 1)), 1400);
    return () => clearTimeout(id);
  }, [tocando, podeAvancar, cronologico.length]);

  if (cronologico.length === 0) {
    return <p className="text-[11px] text-slate-600">Sem eventos suficientes para reproduzir.</p>;
  }

  const atual = cronologico[indice];
  const emReproducao = tocando && podeAvancar;

  return (
    <div className="rounded-lg border border-white/5 bg-black/20 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            if (!podeAvancar) setIndice(0);
            setTocando((t) => !t);
          }}
          className="rounded-md border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 text-[11px] font-semibold text-sky-200 hover:bg-sky-500/20"
        >
          {emReproducao ? "⏸ Pausar" : "▶ Reproduzir evolução da tese"}
        </button>
        <button type="button" onClick={() => { setTocando(false); setIndice((i) => Math.max(0, i - 1)); }} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200" disabled={indice === 0}>
          ← anterior
        </button>
        <button type="button" onClick={() => { setTocando(false); setIndice((i) => Math.min(cronologico.length - 1, i + 1)); }} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-slate-400 hover:text-slate-200" disabled={indice === cronologico.length - 1}>
          próximo →
        </button>
        <span className="ml-auto text-[10px] text-slate-600">{indice + 1}/{cronologico.length}</span>
      </div>
      <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-white/5">
        <div className="h-full rounded-full bg-sky-400/60 transition-all duration-500" style={{ width: `${((indice + 1) / cronologico.length) * 100}%` }} />
      </div>
      <div key={indice} className="mt-2.5 animate-[fadein_0.4s_ease]">
        <p className="text-[9px] uppercase tracking-wider text-slate-600">{fmtData(atual.data)} · {ROTULO_TIPO[atual.tipo] ?? atual.tipo}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-slate-200">{atual.explicacao}</p>
      </div>
      <style>{`@keyframes fadein { from { opacity: 0; transform: translateY(2px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
