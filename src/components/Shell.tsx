import Link from "next/link";

/**
 * Casca visual padrão do Encorpei — fundo com gradientes, navegação
 * unificada e container de tela única. Toda página nova nasce dentro dela.
 */
const LINKS: [string, string][] = [
  ["/", "Dashboard"],
  ["/teses", "Teses"],
  ["/ranking", "Ranking"],
  ["/diario", "Diário"],
  ["/replay", "Replay"],
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
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-300"
                    : "border-white/10 text-slate-300 hover:border-emerald-500/40 hover:text-emerald-300"
                }`}
              >
                {rotulo}
              </Link>
            ))}
          </nav>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-3">{children}</div>
      </div>
    </main>
  );
}
