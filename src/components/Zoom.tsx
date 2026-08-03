"use client";

import { useEffect, useState } from "react";

/**
 * Zoom — clique em qualquer visualização para abrir uma versão ampliada
 * num popup central. Fecha com ✕, clique fora ou tecla Esc.
 * O conteúdo pequeno e o ampliado chegam prontos do servidor (slots) —
 * este componente só controla abrir/fechar.
 */
export function Zoom({
  titulo,
  children,
  ampliado,
}: {
  titulo: string;
  children: React.ReactNode;
  ampliado: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAberto(false);
    };
    window.addEventListener("keydown", fechar);
    return () => window.removeEventListener("keydown", fechar);
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        title="Clique para ampliar"
        className="block w-full cursor-zoom-in text-left transition-opacity hover:opacity-90"
      >
        {children}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={titulo}
          onClick={() => setAberto(false)}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-sm sm:p-8"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-full w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">
                {titulo}
              </h3>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="rounded-lg border border-white/10 px-3 py-1 text-xs text-slate-400 hover:border-white/25 hover:text-slate-100"
              >
                Fechar ✕
              </button>
            </div>
            <div className="mt-4">{ampliado}</div>
            <p className="mt-3 text-[10px] text-slate-600">
              Esc ou clique fora para fechar · dados oficiais (CVM)
            </p>
          </div>
        </div>
      )}
    </>
  );
}
