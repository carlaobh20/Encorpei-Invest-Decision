import type { ConcentracaoRotulo } from "./portfolio-health";

/**
 * RISCO DA CARTEIRA (Bloco 2, Sprint 2.8, Wealth Operating System — Seção
 * 5: "O que hoje ameaça meu patrimônio?").
 *
 * Composição pura sobre sinais que já existem — nenhum motor de risco
 * novo (o sistema não tem um, ver `decision-object.ts`, `risk.nivel`
 * sempre `null`). Cada ameaça listada só aparece se um limiar real for
 * cruzado; lista vazia é o resultado correto quando nada cruza limiar,
 * nunca uma ameaça inventada pra preencher a seção.
 *
 * Limiares reaproveitados de módulos já existentes onde possível
 * (concentração de `portfolio-health.ts`, "quality baixa" do mesmo corte
 * de `erros-classicos.ts`); os que são novos aqui (Carry baixo, % de
 * posições com FDIE crítico) são heurística editorial, documentada.
 */

export type Ameaca = {
  chave: string;
  titulo: string;
  texto: string;
  severidade: "alta" | "media";
};

export type EntradaPortfolioRisk = {
  concentracaoRotulo: ConcentracaoRotulo;
  maiorPosicao: { ticker: string; peso: number } | null;
  carryMedioPonderado: number | null;
  qualitiesPonderadas: { ticker: string; peso: number; quality: number | null }[];
  liquidezRotulo: "alta" | "media" | "baixa" | null;
  posicoesComFdieCritico: string[];
  totalPosicoes: number;
};

/** Editorial — mesmo espírito do corte de "quality baixa" em erros-classicos.ts. */
const QUALIDADE_BAIXA = 40;
const CARRY_BAIXO = 0.03; // abaixo de IPCA+3% a.a.
const PESO_MAIOR_POSICAO_ALTO = 0.3;

export function identificarAmeacasCarteira(entrada: EntradaPortfolioRisk): Ameaca[] {
  const ameacas: Ameaca[] = [];

  if (entrada.concentracaoRotulo === "muito_alta" || entrada.concentracaoRotulo === "alta") {
    ameacas.push({
      chave: "concentracao",
      titulo: "Concentração",
      texto: `Concentração ${entrada.concentracaoRotulo === "muito_alta" ? "muito alta" : "alta"}${entrada.maiorPosicao ? ` — ${entrada.maiorPosicao.ticker} sozinha responde por ${(entrada.maiorPosicao.peso * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% da carteira` : ""}.`,
      severidade: entrada.concentracaoRotulo === "muito_alta" ? "alta" : "media",
    });
  } else if (entrada.maiorPosicao && entrada.maiorPosicao.peso >= PESO_MAIOR_POSICAO_ALTO) {
    ameacas.push({
      chave: "maior_posicao",
      titulo: "Maior posição pesada",
      texto: `${entrada.maiorPosicao.ticker} responde por ${(entrada.maiorPosicao.peso * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% da carteira — um problema nessa empresa específica pesa desproporcionalmente no patrimônio.`,
      severidade: "media",
    });
  }

  if (entrada.carryMedioPonderado !== null && entrada.carryMedioPonderado < CARRY_BAIXO) {
    ameacas.push({
      chave: "carry_baixo",
      titulo: "Carry médio baixo",
      texto: `Carry médio ponderado de IPCA+${(entrada.carryMedioPonderado * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}% — proteção do patrimônio contra inflação abaixo do que o sistema considera confortável.`,
      severidade: "media",
    });
  }

  const baixaQualidade = entrada.qualitiesPonderadas.filter((q) => q.quality !== null && q.quality < QUALIDADE_BAIXA);
  if (baixaQualidade.length > 0) {
    const pesoBaixaQualidade = baixaQualidade.reduce((a, q) => a + q.peso, 0);
    ameacas.push({
      chave: "quality_baixa",
      titulo: "Qualidade baixa em parte da carteira",
      texto: `${baixaQualidade.length} posiç${baixaQualidade.length > 1 ? "ões" : "ão"} (${(pesoBaixaQualidade * 100).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}% do peso) com Quality Score abaixo de ${QUALIDADE_BAIXA}: ${baixaQualidade.map((q) => q.ticker).join(", ")}.`,
      severidade: pesoBaixaQualidade >= 0.2 ? "alta" : "media",
    });
  }

  if (entrada.liquidezRotulo === "baixa") {
    ameacas.push({
      chave: "liquidez_baixa",
      titulo: "Liquidez baixa",
      texto: "Volume financeiro médio ponderado da carteira é baixo — pode ser mais difícil sair de posições rapidamente se precisar.",
      severidade: "media",
    });
  }

  if (entrada.posicoesComFdieCritico.length > 0) {
    ameacas.push({
      chave: "fdie_critico",
      titulo: "Integridade de dado comprometida",
      texto: `${entrada.posicoesComFdieCritico.join(", ")} com verificação crítica do FDIE — checar a fonte antes de confiar nos números dessas posições.`,
      severidade: "alta",
    });
  }

  return ameacas.sort((a, b) => (a.severidade === b.severidade ? 0 : a.severidade === "alta" ? -1 : 1));
}
