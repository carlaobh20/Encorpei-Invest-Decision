import type { CarryEntrada, CarryResultado } from "./types";
import { carryV1Piso } from "./v1-piso";
import { carryV2Growth } from "./v2-growth";
import { carryV3Cash } from "./v3-cash";

/**
 * A ESCADA DO CARRY — os 5 níveis, sempre visíveis, cada um no seu estado
 * real: calculado (com número) ou pendente (com o que falta, por escrito).
 * Nenhum nível some, nenhum nível mente.
 */

export type DegrauCarry = {
  nivel: number;
  nome: string;
  resultado: CarryResultado | null;
  /** presente quando o nível ainda não pode ser calculado */
  pendencia: string | null;
};

export function escadaCarry(e: CarryEntrada): DegrauCarry[] {
  const floor = carryV1Piso.calcular(e);
  const growth = carryV2Growth.calcular(e);
  const cash = carryV3Cash.calcular(e);

  return [
    {
      nivel: 1,
      nome: "Carry Floor (piso)",
      resultado: floor,
      pendencia: null,
    },
    {
      nivel: 2,
      nome: "Carry Growth (+ reinvestimento)",
      resultado: growth.carryReal !== null ? growth : null,
      pendencia:
        growth.carryReal !== null
          ? null
          : "aguarda dividendos pagos (DFC/CVM — robô diário já coleta)",
    },
    {
      nivel: 3,
      nome: "Carry Cash (caixa em vez de lucro contábil)",
      resultado: cash.carryReal !== null ? cash : null,
      pendencia:
        cash.carryReal !== null
          ? null
          : "aguarda caixa operacional e capex (DFC/CVM — mesma coleta diária)",
    },
    {
      nivel: 4,
      nome: "Carry Allocation (o que chega ao acionista)",
      resultado: null,
      pendencia:
        "aguarda HISTÓRICO de composição de capital pra medir diluição real (a coleta diária começou " +
        "02/08/2026 — não é dado que falta buscar, é série que precisa acumular meses de calendário)",
    },
    {
      nivel: 5,
      nome: "Retorno Intrínseco (integra todos)",
      resultado: null,
      pendencia:
        "entra quando os níveis 2-4 existirem com dados reais — será o indicador principal, nunca antes disso",
    },
  ];
}
