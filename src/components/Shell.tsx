import Link from "next/link";

/**
 * Casca do Encorpei v2 — menu lateral por CONCEITO DE DECISÃO + barra
 * superior com busca global. Regras:
 * - Módulos que EXISTEM ficam no menu principal.
 * - Módulos futuros ficam em "Em construção", visualmente rebaixados e
 *   levando a uma página que explica o que são e o que os destrava —
 *   menu não faz promessa silenciosa.
 * - Verde só com significado; interação em azul/neutro.
 */

/**
 * Hierarquia PIC 01 (03/08/2026, renomeada em seguida): Patrimônio →
 * Carteira → Confluence → Teses → Oportunidades → Empresas → Indicadores.
 * Nenhuma rota foi removida — só reorganizada e renomeada: "Meu Dash" é o
 * antigo "Meu Patrimônio" (mesma rota "/"); "Minha Carteira" mescla o que
 * antes eram "Carteira" e "Saúde da Carteira" (que agora redireciona pra
 * "/carteira", sem entrada própria no menu).
 */
const GRUPOS: { rotulo: string; links: [string, string][] }[] = [
  {
    rotulo: "Patrimônio",
    links: [
      ["/", "Meu Dash"],
      // Decision Center (Sprint 2.1, 04/08/2026): passo parcial rumo à
      // navegação-alvo de 6 itens do product-architecture.md (Meu Dash /
      // Decision Center / Empresas / Research Lab / Replay / Sistema) — a
      // migração completa do menu é trabalho de sprint futura, registrada
      // lá; aqui só entra o link novo, sem remover nenhum existente.
      ["/decisoes", "Decision Center"],
      ["/carteira", "Minha Carteira"],
    ],
  },
  {
    rotulo: "Decidir",
    links: [
      ["/radar", "Radar · Oportunidades"],
      ["/compounders", "Compounders"],
      ["/tecnico", "Técnico"],
      ["/teses", "Teses"],
      ["/ranking", "Ranking"],
      ["/comparar", "Comparar"],
    ],
  },
  {
    rotulo: "Registrar",
    links: [
      ["/diario", "Diário"],
      ["/replay", "Replay"],
      ["/timemachine", "Time Machine"],
    ],
  },
  {
    rotulo: "Transparência",
    links: [
      ["/algoritmo", "Algoritmo"],
      ["/auditoria", "Auditoria"],
    ],
  },
];

const FUTUROS: [string, string][] = [
  ["watchlist", "Watchlist"],
  ["backtests", "Backtests"],
  ["ia", "IA explicativa"],
  ["laboratorio", "Laboratório"],
];

export function Shell({
  ativo,
  titulo,
  subtitulo,
  children,
  rolagem = false,
}: {
  ativo: string;
  titulo: string;
  subtitulo?: string;
  children: React.ReactNode;
  /** true = página com rolagem vertical (ex.: Decision Center) */
  rolagem?: boolean;
}) {
  return (
    <main className="flex h-dvh overflow-hidden bg-[#07111e] text-slate-100 [background:radial-gradient(75%_55%_at_25%_-8%,rgba(34,224,166,0.05),transparent),radial-gradient(60%_50%_at_100%_100%,rgba(56,189,248,0.045),transparent),#07111e]">
      {/* ---------- menu lateral ---------- */}
      <aside className="hidden w-52 shrink-0 flex-col border-r border-white/5 bg-white/[0.02] px-3 py-4 lg:flex">
        <Link href="/" className="px-2 text-sm font-semibold tracking-tight">
          <span className="text-slate-100">encorpei</span>{" "}
          <span className="text-sky-400">invest</span>
        </Link>
        <nav className="mt-5 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto text-[12.5px]">
          {GRUPOS.map((g) => (
            <div key={g.rotulo}>
              <p className="px-2 text-[9.5px] uppercase tracking-[0.25em] text-slate-600">
                {g.rotulo}
              </p>
              <div className="mt-1 space-y-0.5">
                {g.links.map(([href, rotulo]) => (
                  <Link
                    key={href}
                    href={href}
                    className={`block rounded-lg px-2 py-1.5 transition-colors ${
                      ativo === href
                        ? "bg-sky-500/10 text-sky-200"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-100"
                    }`}
                  >
                    {rotulo}
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="px-2 text-[9.5px] uppercase tracking-[0.25em] text-slate-700">
              Em construção
            </p>
            <div className="mt-1 space-y-0.5">
              {FUTUROS.map(([m, rotulo]) => (
                <Link
                  key={m}
                  href={`/em-breve?m=${m}`}
                  className="block rounded-lg px-2 py-1.5 text-slate-600 transition-colors hover:bg-white/[0.03] hover:text-slate-400"
                >
                  {rotulo}
                </Link>
              ))}
            </div>
          </div>
        </nav>
        <p className="px-2 text-[9.5px] leading-snug text-slate-700">
          Uso pessoal. Não é recomendação de investimento.
        </p>
      </aside>

      {/* ---------- coluna principal ---------- */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* barra superior */}
        <header className="flex items-center justify-between gap-4 border-b border-white/5 px-6 py-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-bold tracking-tight">{titulo}</h1>
            {subtitulo && (
              <p className="mt-0.5 max-w-3xl truncate text-[11px] text-slate-500">{subtitulo}</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <form action="/buscar" className="hidden sm:block">
              <input
                type="search"
                name="q"
                placeholder="Buscar empresa…"
                className="w-48 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-600 focus:border-sky-400/40 focus:outline-none"
              />
            </form>
            {process.env.NEXT_PUBLIC_AUTH_ATIVO === "true" && (
              <Link
                href="/logout"
                className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-500 hover:border-red-500/40 hover:text-red-300"
              >
                Sair
              </Link>
            )}
          </div>
        </header>

        {/* navegação compacta no mobile (sidebar oculta) */}
        <nav className="flex gap-1.5 overflow-x-auto border-b border-white/5 px-4 py-2 text-[11px] lg:hidden">
          {GRUPOS.flatMap((g) => g.links).map(([href, rotulo]) => (
            <Link
              key={href}
              href={href}
              className={`shrink-0 rounded-lg border px-2.5 py-1 ${
                ativo === href
                  ? "border-sky-400/40 bg-sky-500/10 text-sky-200"
                  : "border-white/10 text-slate-400"
              }`}
            >
              {rotulo}
            </Link>
          ))}
        </nav>

        {/* conteúdo */}
        <div
          className={`flex min-h-0 flex-1 flex-col gap-3 px-6 py-4 ${
            rolagem ? "overflow-y-auto" : "overflow-hidden"
          }`}
        >
          {children}
        </div>
      </div>
    </main>
  );
}
