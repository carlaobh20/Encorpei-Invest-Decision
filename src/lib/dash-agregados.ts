import type { LinhaCarteira } from "@/lib/carteira";
import type { LinhaRadar } from "@/lib/radar";
import type { LinhaCompounder } from "@/lib/compounder-dados";
import type { Decision } from "@/lib/decision-object";
import {
  montarLinhasSaude,
  calcularSaudeCarteira,
  confluenciaMediaPonderada,
  type SaudeCarteira,
  type ConfluenciaMediaPonderada,
} from "./portfolio-health";

/**
 * DASH AGREGADOS (Bloco 2 — Sprint 2.1, Meu Dash).
 *
 * Monta "Saúde da Carteira" para o Meu Dash reaproveitando as funções PURAS
 * de portfolio-health.ts (Concentração, ROIC Médio, Valuation, Sensibilidade
 * Selic, Diversificação) sem duplicá-las — só troca QUAL Carry/Confluence
 * alimenta o cálculo:
 *
 * - Carry: `montarLinhasSaude` normalmente usa `radar.ts` (carryVigente,
 *   Carry v1). Aqui é substituído pelo Carry do Decision Object (Foundation,
 *   escadaCarry) — decisão explícita da Opção A (só Meu Dash usa Foundation;
 *   /carteira e /radar continuam em v1 até serem migrados).
 * - Confluence: idem, usa `decision.confluence` (Confluence v2, 8
 *   componentes) em vez de `confluencia.ts` v1 (4 componentes).
 * - ROIC/Valuation/Sensibilidade: NÃO são scores concorrentes, são dado
 *   fundamentalista bruto (roicMedia4Tri, earnings yield, sensibilidade a
 *   juros do Compounder) — continuam vindo de radar/compounder-dados sem
 *   divergência, não fazem parte do escopo da Opção A.
 * - Growth Médio: Decision.growth não tem motor real (sempre null, ver
 *   decision-object.ts) — exposto aqui como `growthIndisponivel: true` para
 *   a tela mostrar "—" em vez de inventar ou esconder a ausência.
 * - Liquidez Médio: métrica NOVA (não existia em portfolio-health.ts),
 *   volume médio ponderado em R$/dia (`volumeMedioReaisPorTicker`, calculado
 *   em portfolio-fit-dados.ts a partir dos últimos ~30 pregões). O rótulo
 *   alta/média/baixa usa limiares de convenção de mercado (não são dado
 *   calculado, são um corte editorial documentado) — > R$10mi/dia = alta,
 *   R$1mi–10mi = média, < R$1mi = baixa.
 */

export type LiquidezCarteira = {
  /** média ponderada por peso do volume financeiro diário (R$), últimos ~30 pregões por posição */
  valor: number | null;
  rotulo: "alta" | "media" | "baixa" | null;
  cobertura: number;
  total: number;
};

export type SaudeCarteiraV2 = {
  /** concentração, ROIC médio, valuation médio, sensibilidade Selic — inalterados; carryMedioPonderado aqui já é v2 (Decision.carry) */
  saude: SaudeCarteira;
  confluenceV2: ConfluenciaMediaPonderada;
  liquidez: LiquidezCarteira;
  /** true = Decision.growth não tem motor real; tela deve mostrar "—", nunca 0 ou null decorativo */
  growthIndisponivel: true;
};

const LIMIAR_LIQUIDEZ_ALTA_REAIS = 10_000_000;
const LIMIAR_LIQUIDEZ_MEDIA_REAIS = 1_000_000;

function rotularLiquidez(valor: number): "alta" | "media" | "baixa" {
  if (valor >= LIMIAR_LIQUIDEZ_ALTA_REAIS) return "alta";
  if (valor >= LIMIAR_LIQUIDEZ_MEDIA_REAIS) return "media";
  return "baixa";
}

export function montarSaudeCarteiraV2(
  linhasCarteira: LinhaCarteira[],
  radarLinhas: LinhaRadar[],
  compounderLinhas: LinhaCompounder[],
  decisions: Map<string, Decision>,
  volumeMedioReaisPorTicker: Map<string, number | null>
): SaudeCarteiraV2 {
  const linhasBase = montarLinhasSaude(linhasCarteira, radarLinhas, compounderLinhas);

  // Carry v2: substitui radar.carryReal (v1) por Decision.carry (Foundation) — só ROIC/EY/sensibilidade seguem de radar/compounder.
  const linhasV2 = linhasBase.map((l) => ({
    ...l,
    carryReal: decisions.get(l.ticker)?.carry ?? null,
  }));
  const saude = calcularSaudeCarteira(linhasV2);

  const confluenceV2 = confluenciaMediaPonderada(
    linhasBase.map((l) => ({ peso: l.peso, score: decisions.get(l.ticker)?.confluence ?? null }))
  );

  const itensLiquidez = linhasBase.map((l) => ({
    peso: l.peso,
    valor: volumeMedioReaisPorTicker.get(l.ticker) ?? null,
  }));
  const disponiveisLiquidez = itensLiquidez.filter(
    (i): i is { peso: number; valor: number } => i.valor !== null
  );
  const pesoTotalLiquidez = disponiveisLiquidez.reduce((a, i) => a + i.peso, 0);
  const valorLiquidez =
    disponiveisLiquidez.length > 0 && pesoTotalLiquidez > 0
      ? disponiveisLiquidez.reduce((a, i) => a + i.valor * i.peso, 0) / pesoTotalLiquidez
      : null;

  return {
    saude,
    confluenceV2,
    liquidez: {
      valor: valorLiquidez,
      rotulo: valorLiquidez !== null ? rotularLiquidez(valorLiquidez) : null,
      cobertura: disponiveisLiquidez.length,
      total: linhasBase.length,
    },
    growthIndisponivel: true,
  };
}
