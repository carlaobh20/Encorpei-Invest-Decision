import Link from "next/link";

/**
 * Casca visual padrão do Encorpei — fundo com gradientes, navegação
 * unificada e container de tela única. Toda página nova nasce dentro dela.
 */
/**
 * Navegação organizada pelo CONCEITO DE DECISÃO, não por telas:
 * decidir → analisar → registrar → auditar. Só entram itens que
 * existem de verdade — menu não faz promessa.
 */
const LINKS: [string, string][] = [
  ["/", "Decision Center"],
  ["/teses", "Teses"],
  ["/ranking", "Ranking"],
  ["/comparar", "Comparar"],
  ["/diario", "Diário"],
  ["/replay", "Replay"],
  ["/timemachine", "Time Machine"],
  ["/algoritmo", "Algoritmo"],
  ["/auditoria", "Auditoria"],
];

export function Shell({
  ativo,
  titulo,
  subtitulo,
  children,
}: {
  ativo: string;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
}) {
  return (
    <main className="h-dvh overflow-hidden bg-slate-950 text-slate-100 [background:radial-gradient(80%_60%_at_50%_0%,rgba(16,185,129,0.07),transparent),radial-gradient(60%_50%_at_100%_100%,rgba(59,130,246,0.05),transparent),#020617]">
      <div className="mx-auto flex h-full max-w-6xl flex-col gap-3 px-6 py-4">
        <header className="flex items-end justify-between">
          <div>
            <Link href="/" className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-500 hover:text-emerald-400">
              Encorpei <span className="text-emerald-500">Invest</span>
            </Link>
            <h1 className="mt-0.5 text-2xl font-bold tracking-tight">{titulo}</h1>
            {subtitulo && <p className="mt-0.5 max-w-2xl text-xs text-slate-500">{subtitulo}</p>}
          </div>
          <nav className="flex items-center gap-2 text-xs">
            {LINKS.map(([href, rotulo]) => (
              <Link
                key={href}
                href={href}
                className={`rounded-lg border px-3 py-1.5 transition-colors ${
                  ativo === href
                    ? "border-sky-400/40 bg-sky-500/10 text-sky-200"
                    : "border-white/10 text-slate-400 hover:border-white/25 hover:text-slate-100"
                }`}
              >
                {rotulo}
              </Link>
            ))}
            {process.env.NEXT_PUBLIC_AUTH_ATIVO === "true" && (
              <Link
                href="/logout"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-slate-500 hover:border-red-500/40 hover:text-red-300"
              >
                Sair
              </Link>
            )}
          </nav>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3">{children}</div>
      </div>
    </main>
  );
}
