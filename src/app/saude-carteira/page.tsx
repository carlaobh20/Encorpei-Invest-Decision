import { redirect } from "next/navigation";

/**
 * "/saude-carteira" foi MESCLADA em "/carteira" (Minha Carteira) em
 * 03/08/2026 — todos os indicadores desta página (concentração, Carry
 * médio, ROIC médio, Valuation médio, sensibilidade à Selic, diversificação
 * por modelo) agora vivem no painel "Saúde da Carteira" dentro de
 * "/carteira". Este arquivo continua existindo só para não quebrar links
 * antigos (salvos em favoritos, histórico, etc.) — nunca link morto.
 */
export default function SaudeCarteira() {
  redirect("/carteira");
}
