import { CARRY_CONFIG, type CarryCalculator } from "./types";
import { carryV1Piso } from "./v1-piso";
import { carryV2Growth } from "./v2-growth";
import { carryV3Cash } from "./v3-cash";

/**
 * Registro de versões do Carry Engine. Trocar metodologia = registrar nova
 * versão aqui e mudar CARRY_CONFIG.versaoVigente — as antigas permanecem
 * para reprocessar histórico (mesma disciplina do versao_algoritmo).
 */
const CALCULADORAS: Record<number, CarryCalculator> = {
  1: carryV1Piso,
  2: carryV2Growth,
  3: carryV3Cash,
};

export function carryVigente(): CarryCalculator {
  return CALCULADORAS[CARRY_CONFIG.versaoVigente];
}

export * from "./types";
export { escadaCarry, type DegrauCarry } from "./escada";
