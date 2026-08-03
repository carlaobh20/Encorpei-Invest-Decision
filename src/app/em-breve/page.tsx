import Link from "next/link";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

/**
 * Página dos módulos EM CONSTRUÇÃO — o placeholder honesto.
 * Cada módulo diz o que será e, principalmente, O QUE O DESTRAVA.
 * Nenhum número inventado, nenhuma porta trancada sem explicação.
 */

const MODULOS: Record<string, { nome: string; oque: string; destrava: string }> = {
  benchmarks: {
    nome: "Carteira vs CDI/Ibovespa",
    oque: "A Carteira já existe (menu Registrar). O que falta é a comparação com benchmarks: sua carteira rendeu mais ou menos que o CDI e o Ibovespa? E Sharpe/risco medidos de verdade.",
    destrava: "A coleta de CDI/IPCA (BCB) e Ibovespa (mesma fonte das ações) já está ligada e roda sozinha a partir de hoje. O que falta é acumular: cada dia que passa com posições registradas soma um ponto na série de patrimônio — sem série longa o bastante, qualquer Sharpe seria número inventado.",
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
  macro: {
    nome: "Thesis Evolution (Macro + Cenários)",
    oque: "Leitura semanal do cenário macro OFICIAL (Relatório Focus/BCB: IPCA, Selic, PIB, câmbio) com variação vs semanas anteriores, perfis de sensibilidade por empresa e, no futuro, cenários recalculando o Carry. Macro INFORMA — nunca altera uma tese sozinho.",
    destrava: "O coletor semanal do Focus já existe (segundas, 9h). O card acende com a migração 012. Perfis de sensibilidade são rascunhos qualitativos que o Carlos ratifica (como as teses). Macro Score 0-100, cenários no Carry e o Market Digital Twin ficam gateados: exigem elasticidades medidas por empresa — sem isso seria número inventado, e não fazemos isso.",
  },
  gestao: {
    nome: "Management Intelligence",
    oque: "Leitura da comunicação OFICIAL da administração (fatos relevantes, comunicados, apresentações, calls): o que prometeram, o que executaram, mudança de tom — sempre com o trecho original rastreável. O acervo de documentos já está sendo coletado diariamente do dataset IPE da CVM.",
    destrava: "A interpretação por IA exige a chave da API do Claude na Vercel (custo por documento). A nota de CREDIBILIDADE da gestão só nasce depois de trimestres de prometido-vs-entregue medidos — nota sem histórico é decoração, e não fazemos decoração.",
  },
  laboratorio: {
    nome: "Laboratório",
    oque: "Ambiente para testar novas réguas e pesos do algoritmo em rascunho, comparando com a versão vigente antes de promover (sempre criando versão nova, nunca sobrescrevendo).",
    destrava: "Track record da versão 1 — só faz sentido testar variações quando houver base de comparação real.",
  },
  rebalancear: {
    nome: "Rebalancear carteira",
    oque: "Sugestão de quanto comprar ou vender de cada posição para levar a carteira de volta a um peso alvo — por posição ou por modelo de negócio. O botão já existe em Minha Carteira; o motor por trás dele ainda não.",
    destrava: "Falta definir e registrar a régua de \"peso alvo\" — decisão sua (Carlos), não um cálculo automático. Sem essa régua definida e versionada, qualquer sugestão de rebalanceamento seria um número inventado, não uma regra.",
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
