import type { IntelligenceCapsule, NivelConfianca } from "./intelligence-capsule";
import { nivelConfiancaDoFdie } from "./intelligence-capsule";
import { ROTULO_BANDA_WEALTH_HEALTH, type WealthHealth } from "./wealth-health";

/**
 * INTELLIGENCE CAPSULE DO PATRIMÔNIO (Bloco 2, Sprint 2.8, Wealth
 * Operating System — Seção 9, topo do Meu Dash).
 *
 * Mesma estrutura fixa de `intelligence-capsule.ts` (Sprint 2.7), agora
 * composta a partir de sinais de CARTEIRA em vez de sinais por empresa:
 * Wealth Health (Sprint 2.8), contagem de teses quebradas (Thesis Engine,
 * já calculado por tela), e FDIE agregado das posições. "Sua meta
 * patrimonial continua alcançável" (exemplo da spec) só aparece quando
 * `tempoEstimadoAnos`/`gapMeta` vierem de `wealth-engine.ts` com uma meta
 * real configurada — sem meta, o campo correspondente fica de fora, nunca
 * fabricado.
 */

export type EntradaWealthCapsule = {
  wealthHealth: WealthHealth;
  tesesQuebradas: number;
  totalTeses: number;
  fdie: { ok: number; alerta: number; critico: number; total: number };
  gapMetaTexto: string | null;
};

function componenteMaisFraco(wealthHealth: WealthHealth): string | null {
  const disponiveis = wealthHealth.componentes.filter((c) => c.disponivel && c.pontos !== null);
  if (disponiveis.length === 0) return null;
  const pior = [...disponiveis].sort((a, b) => (a.pontos as number) - (b.pontos as number))[0];
  return pior.rotulo;
}

function componenteMaisForte(wealthHealth: WealthHealth): string | null {
  const disponiveis = wealthHealth.componentes.filter((c) => c.disponivel && c.pontos !== null);
  if (disponiveis.length === 0) return null;
  const melhor = [...disponiveis].sort((a, b) => (b.pontos as number) - (a.pontos as number))[0];
  return melhor.rotulo;
}

export function montarIntelligenceCapsulePatrimonio(entrada: EntradaWealthCapsule): IntelligenceCapsule {
  const { wealthHealth, tesesQuebradas, totalTeses, fdie, gapMetaTexto } = entrada;

  const resumo =
    wealthHealth.score !== null
      ? `Wealth Health ${wealthHealth.score}/100 — ${ROTULO_BANDA_WEALTH_HEALTH[wealthHealth.banda]}.`
      : "Wealth Health ainda sem dado suficiente pra calcular.";

  const partesImporta: string[] = [];
  partesImporta.push(
    tesesQuebradas === 0
      ? `Nenhuma das ${totalTeses} tese${totalTeses === 1 ? "" : "s"} acompanhada${totalTeses === 1 ? "" : "s"} está quebrada hoje.`
      : `${tesesQuebradas} de ${totalTeses} tese${totalTeses === 1 ? "" : "s"} quebrada${tesesQuebradas === 1 ? "" : "s"} — precisa de decisão.`
  );
  if (gapMetaTexto) partesImporta.push(gapMetaTexto);

  const nivelConfianca: NivelConfianca = nivelConfiancaDoFdie(fdie);

  return {
    resumo,
    porQueImporta: partesImporta.join(" "),
    maiorOportunidade: componenteMaisForte(wealthHealth)
      ? `${componenteMaisForte(wealthHealth)} é hoje o componente mais forte da sua Saúde Patrimonial.`
      : "Sem componente forte identificável ainda — dado insuficiente.",
    maiorRisco: componenteMaisFraco(wealthHealth)
      ? `${componenteMaisFraco(wealthHealth)} é hoje o componente mais fraco da sua Saúde Patrimonial — ver Seção Risco da Carteira.`
      : "Sem componente fraco identificável ainda — dado insuficiente.",
    nivelConfianca,
    precisoAgir: tesesQuebradas > 0 || fdie.critico > 0,
    precisoAgirMotivo:
      tesesQuebradas > 0
        ? "Existe pelo menos uma tese quebrada na carteira — ver Decisões Prioritárias."
        : fdie.critico > 0
        ? "Existe verificação crítica do FDIE em pelo menos uma posição — checar a fonte."
        : "Nenhum sinal crítico hoje.",
  };
}
