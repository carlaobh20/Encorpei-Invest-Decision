export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center px-6">
      <div className="max-w-2xl text-center space-y-6">
        <p className="text-sm uppercase tracking-[0.3em] text-emerald-400">
          Fase 0 · Fundação
        </p>
        <h1 className="text-5xl font-bold tracking-tight">
          Encorpei <span className="text-emerald-400">Invest</span>
        </h1>
        <p className="text-lg text-slate-400">
          Sistema operacional de inteligência para investimentos.
          <br />
          Não prevemos o mercado. Aumentamos a qualidade da decisão.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 text-left">
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500">Centro do sistema</p>
            <p className="mt-1 font-semibold">Tese Viva</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500">Motor</p>
            <p className="mt-1 font-semibold">Decision Engine</p>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs text-slate-500">Princípio</p>
            <p className="mt-1 font-semibold">Explicabilidade</p>
          </div>
        </div>
        <p className="pt-8 text-xs text-slate-600">
          Deploy automático via GitHub → Vercel · Se você está vendo esta
          página, o gate da Fase 0 foi cumprido.
        </p>
        <div className="flex justify-center gap-3">
          <a
            href="/teses"
            className="inline-block rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Teses Vivas →
          </a>
          <a
            href="/ranking"
            className="inline-block rounded-lg border border-emerald-700 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-950"
          >
            Ranking →
          </a>
          <a
            href="/auditoria"
            className="inline-block rounded-lg border border-emerald-700 px-4 py-2 text-sm text-emerald-400 hover:bg-emerald-950"
          >
            Auditoria de dados →
          </a>
        </div>
      </div>
    </main>
  );
}
