"use client";

import { useMemo, useState } from "react";
import { simularMeta } from "@/lib/wealth-engine";

/**
 * SIMULADOR DE META PATRIMONIAL (Bloco 2, Sprint 2.9, Wealth Intelligence
 * Layer — Módulo 1).
 *
 * Decisão de escopo (registrada no roadmap, não escondida): "cadastrar"
 * meta/prazo/aporte/inflação de forma PERSISTENTE exigiria uma tabela nova
 * — já existem 2 migrações escritas e paradas (022/023) pelo bloqueio de
 * conector Supabase; uma terceira sem forma de testar contra o banco real
 * repetiria a mesma decisão já tomada no Sprint 2.8. Este componente entrega
 * o valor da simulação SEM depender do banco: Carlos digita a meta toda vez
 * (efêmero, não salva entre sessões) e vê a projeção na hora — 100% do
 * cálculo roda no navegador via `simularMeta` (wealth-engine.ts).
 *
 * "Nunca criar estimativas sem identificar claramente quando forem
 * projeções" — por isso todo resultado aqui é rotulado "projeção
 * determinística", nunca "probabilidade".
 */

function formatarReais(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
}

export function SimuladorMeta({
  patrimonioAtual,
  cagrRealHistoricoAA,
}: {
  patrimonioAtual: number | null;
  cagrRealHistoricoAA: number | null;
}) {
  const [meta, setMeta] = useState("1000000");
  const [prazo, setPrazo] = useState("10");
  const [aporte, setAporte] = useState("1000");
  const [inflacao, setInflacao] = useState("4");
  const [cagrOverride, setCagrOverride] = useState<string>("");

  const cagrUsado =
    cagrOverride !== "" && !Number.isNaN(Number(cagrOverride))
      ? Number(cagrOverride) / 100
      : cagrRealHistoricoAA;

  const resultado = useMemo(() => {
    if (patrimonioAtual === null) return null;
    const metaNum = Number(meta);
    const prazoNum = Number(prazo);
    const aporteNum = Number(aporte);
    const inflacaoNum = Number(inflacao);
    if ([metaNum, prazoNum, aporteNum, inflacaoNum].some((n) => Number.isNaN(n))) return null;
    return simularMeta({
      patrimonioAtual,
      metaPatrimonial: metaNum,
      prazoAnos: prazoNum,
      aporteMensalReal: aporteNum,
      cagrRealAA: cagrUsado,
      inflacaoEspAA: inflacaoNum / 100,
    });
  }, [patrimonioAtual, meta, prazo, aporte, inflacao, cagrUsado]);

  if (patrimonioAtual === null) {
    return <p className="text-[12px] text-slate-500">Sem série de patrimônio suficiente ainda para simular.</p>;
  }

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label className="block">
          <span className="block text-[8.5px] uppercase tracking-wider text-slate-500">Meta (R$, hoje)</span>
          <input value={meta} onChange={(e) => setMeta(e.target.value)} inputMode="numeric"
            className="mt-0.5 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[12px] text-slate-100" />
        </label>
        <label className="block">
          <span className="block text-[8.5px] uppercase tracking-wider text-slate-500">Prazo (anos)</span>
          <input value={prazo} onChange={(e) => setPrazo(e.target.value)} inputMode="numeric"
            className="mt-0.5 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[12px] text-slate-100" />
        </label>
        <label className="block">
          <span className="block text-[8.5px] uppercase tracking-wider text-slate-500">Aporte mensal (R$)</span>
          <input value={aporte} onChange={(e) => setAporte(e.target.value)} inputMode="numeric"
            className="mt-0.5 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[12px] text-slate-100" />
        </label>
        <label className="block">
          <span className="block text-[8.5px] uppercase tracking-wider text-slate-500">Inflação esperada (% a.a.)</span>
          <input value={inflacao} onChange={(e) => setInflacao(e.target.value)} inputMode="numeric"
            className="mt-0.5 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[12px] text-slate-100" />
        </label>
      </div>

      <label className="block">
        <span className="block text-[8.5px] uppercase tracking-wider text-slate-500">
          CAGR real assumido (% a.a. acima do IPCA)
          {cagrRealHistoricoAA !== null && cagrOverride === "" && " — usando o histórico da carteira"}
        </span>
        <input
          value={cagrOverride}
          onChange={(e) => setCagrOverride(e.target.value)}
          placeholder={cagrRealHistoricoAA !== null ? (cagrRealHistoricoAA * 100).toFixed(1) : "sem histórico suficiente — informe um valor"}
          inputMode="numeric"
          className="mt-0.5 w-full rounded-md border border-white/10 bg-white/5 px-2 py-1 font-mono text-[12px] text-slate-100"
        />
      </label>

      {resultado === null ? (
        <p className="text-[11px] text-amber-300">Preencha os campos com números válidos para simular.</p>
      ) : resultado.motivoIndisponivel ? (
        <p className="text-[11px] text-amber-300">{resultado.motivoIndisponivel}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-white/10 bg-white/[0.02] p-2.5 sm:grid-cols-3">
          <div>
            <p className="text-[8.5px] uppercase tracking-wider text-slate-500">Patrimônio projetado</p>
            <p className="font-mono text-[13px] font-bold text-slate-100">{formatarReais(resultado.patrimonioProjetado!)}</p>
          </div>
          <div>
            <p className="text-[8.5px] uppercase tracking-wider text-slate-500">Gap até a meta</p>
            <p className={`font-mono text-[13px] font-bold ${resultado.gap! > 0 ? "text-amber-300" : "text-emerald-400"}`}>
              {resultado.gap! > 0 ? formatarReais(resultado.gap!) + " a menos" : "meta batida na projeção"}
            </p>
          </div>
          <div>
            <p className="text-[8.5px] uppercase tracking-wider text-slate-500">CAGR real necessário</p>
            <p className="font-mono text-[13px] font-bold text-slate-100">
              {resultado.cagrNecessarioAA !== null ? `${(resultado.cagrNecessarioAA * 100).toFixed(1)}% a.a.` : "meta inatingível nesta simulação"}
            </p>
          </div>
          {resultado.metaNominalEstimada !== null && (
            <div className="col-span-2 sm:col-span-3">
              <p className="text-[8.5px] uppercase tracking-wider text-slate-500">Meta em valores nominais estimados (referência)</p>
              <p className="font-mono text-[11px] text-slate-400">{formatarReais(resultado.metaNominalEstimada)}</p>
            </div>
          )}
        </div>
      )}
      <p className="text-[9.5px] text-slate-700">{resultado?.avisoProjecao ?? "Projeção determinística — nunca uma probabilidade estatística."}</p>
      <p className="text-[9px] text-slate-700">
        Simulação efêmera — não salva entre sessões (sem cadastro persistente ainda; ver Goal Engine no roadmap).
      </p>
    </div>
  );
}
