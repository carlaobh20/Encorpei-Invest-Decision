import Link from "next/link";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

/**
 * Página dos módulos EM CONSTRUÇÃO — o placeholder honesto.
 * Cada módulo diz o que será e, principalmente, O QUE O DESTRAVA.
 * Nenhum número inventado, nenhuma porta trancada sem explicação.
 */

const MODULOS: Record<string, { nome: string; oque: string; destrava: string }> = {
  carteiras: {
    nome: "Carteiras",
    oque: "Suas posições reais organizadas por estratégia, com a saúde da carteira (nota média ponderada, risco, diversificação) calculada sobre o que você de fato possui.",
    destrava: "Registro de posições (quantidade e preço médio por papel). Entra depois que o hábito do Diário estiver rodando — carteira sem diário vira só um número bonito.",
  },
  watchlist: {
    nome: "Watchlist",
    oque: "Empresas que você quer vigiar de perto sem tese formal ainda — um estágio entre o Radar e a Tese Viva.",
    destrava: "Nada técnico — entra quando o fluxo Radar → estudo → tese estiver rodado algumas vezes e ficar claro o que vale vigiar.",
  },
  backtests: {
    nome: "Backtests",
    oque: "Testar as réguas do algoritmo contra o passado: se o sistema existisse há 2 anos, o que ele teria dito?",
    destrava: "Histórico de preços e notas acumulado. As notas começaram em 31/07/2026 — cada dia que passa alimenta o backtest futuro. Estimativa honesta: útil a partir de alguns meses de dados.",
  },
  ia: {
    nome: "IA explicativa",
    oque: "Resumos e explicações em linguagem natural gerados por IA sobre os fatos que as regras produziram. A IA NUNCA decide nem pontua — só traduz.",
    destrava: "Configurar a chave da API do Claude na Vercel. As explicações atuais do sistema são geradas por regras (templates) — a IA as tornará mais ricas, não mais verdadeiras.",
  },
  laboratorio: {
    nome: "Laboratório",
    oque: "Ambiente para testar novas réguas e pesos do algoritmo em rascunho, comparando com a versão vigente antes de promover (sempre criando versão nova, nunca sobrescrevendo).",
    destrava: "Track record da versão 1 — só faz sentido testar variações quando houver base de comparação real.",
  },
};

export default async function EmBreve({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const { m } = await searchParams;
  const foco = m && MODULOS[m] ? m : null;

  return (
    <Shell
      ativo="/em-breve"
      titulo="Em construção"
      subtitulo="O que ainda não existe aparece aqui com nome, propósito e o que destrava — nunca como porta trancada nem número inventado."
      rolagem
    >
      <div className="grid max-w-4xl grid-cols-1 gap-3 md:grid-cols-2">
        {Object.entries(MODULOS).map(([chave, mod]) => (
          <section
            key={chave}
            className={`rounded-2xl border p-5 ${
              foco === chave
                ? "border-sky-400/30 bg-sky-500/[0.06]"
                : "border-white/5 bg-white/[0.03]"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">{mod.nome}</h2>
              <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-slate-500">
                planejado
              </span>
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-300">{mod.oque}</p>
            <p className="mt-2 text-[11.5px] leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-400">O que destrava: </span>
              {mod.destrava}
            </p>
          </section>
        ))}
      </div>
      <p className="text-[11px] text-slate-600">
        Ordem de entrada definida pelos gates do roadmap — não por ansiedade.{" "}
        <Link href="/" className="text-sky-400 hover:underline">← voltar ao Decision Center</Link>
      </p>
    </Shell>
  );
}
