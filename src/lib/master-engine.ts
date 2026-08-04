import { auditarEmpresa, resumoSeveridade, type EmpresaAuditavel, type Verificacao } from "./auditoria";
import { escadaCarry, melhorDegrauCalculavel, type DegrauCarry } from "./carry/escada";
import type { CarryEntrada } from "./carry/types";
import { calcularConfluenciaV2, ROTULO_CONVICCAO, type ConfluenciaV2Resultado, type Conviccao } from "./confluencia";
import { calcularProbabilidade, type ResultadoProbabilidade } from "./probability-engine";
import type { DecisaoAvaliada } from "./decision-history";

/**
 * MASTER DECISION ENGINE (Foundation v3 — Módulo 1).
 *
 * A especificação pede um fluxo obrigatório único:
 *   FDIE → Fundamentos → Carry → Growth → Technical → Macro → Consensus →
 *   Management → Portfolio → Confluence → Decision
 * e que "todos os motores existentes deixem de conversar com a interface" —
 * só o Master Engine alimentaria as telas.
 *
 * DECISÃO ARQUITETURAL EXPLÍCITA (registrada por escrito, não escondida):
 * este Bloco 1 constrói o Master Engine de verdade — ele roda FDIE, monta o
 * Carry pela escada, calcula Confluence v2 (que já embute Fundamentos,
 * Growth, Technical, Macro, Consensus, Management e Portfolio — os 5
 * últimos como pendência documentada, ver confluencia.ts) e a Probabilidade
 * histórica quando há decisões registradas. O que este Bloco 1 NÃO faz é
 * arrancar os 3 call sites que hoje calculam nota fora deste fluxo
 * (`radar.ts`, `/api/teses/avaliar`, `/comparar`) e forçá-los a passar por
 * aqui — isso seria reescrever/religar rotas de produção que já foram
 * tocadas duas vezes hoje (fiação do motor + fix do gráfico), risco de
 * quebrar o que está no ar sem necessidade. Migrar os 3 call sites para o
 * Master Engine fica como PENDÊNCIA EXPLÍCITA do Bloco 2 (ver relatório
 * final) — decisão minha, registrada aqui e no relatório, para o Carlos
 * ratificar ou não.
 *
 * Função pura: recebe os dados já coletados (nenhuma chamada a Supabase ou
 * API aqui — isso é encanamento de rota/`-dados.ts`, fora do domínio) e
 * devolve o pacote completo de decisão.
 */

export type EntradaMasterEngine = {
  ticker: string;
  auditoria: EmpresaAuditavel;
  fundamentosScore: number | null;
  fundamentosComponentes: number;
  compounderScore: number | null;
  carryEntrada: CarryEntrada;
  technicalScore: number | null;
  /** decisões já julgadas (decision-history.ts) para este ticker/escopo — opcional */
  decisoesAvaliadas?: DecisaoAvaliada[];
};

export type ResultadoMasterEngine = {
  ticker: string;
  fdie: { verificacoes: Verificacao[]; resumo: ReturnType<typeof resumoSeveridade> };
  carry: { degraus: DegrauCarry[]; melhor: DegrauCarry };
  confluence: ConfluenciaV2Resultado;
  probabilidade: ResultadoProbabilidade | null;
  decisao: {
    conviccao: Conviccao;
    /** true quando o FDIE achou pelo menos 1 verificação crítica — sinal para checar a fonte antes de confiar em qualquer nota */
    bloqueadaPorFdie: boolean;
    explicacao: string;
  };
  metodo: string;
};

export function calcularMasterDecision(entrada: EntradaMasterEngine): ResultadoMasterEngine {
  // 1) FDIE — sempre roda primeiro; é auditoria de integridade, não nota.
  const verificacoes = auditarEmpresa(entrada.auditoria);
  const resumo = resumoSeveridade(verificacoes);

  // 2) Carry — escada completa, usa o degrau mais alto calculável.
  const degraus = escadaCarry(entrada.carryEntrada);
  const melhor = melhorDegrauCalculavel(degraus);

  // 3) Confluence v2 — combina Fundamentos+Compounder (Quality), Carry e
  //    Technical (os 3 com motor real hoje); Growth/Macro/Consensus/
  //    Management/Portfolio entram como pendência documentada dentro dela.
  const confluence = calcularConfluenciaV2({
    fundamentosScore: entrada.fundamentosScore,
    fundamentosComponentes: entrada.fundamentosComponentes,
    compounderScore: entrada.compounderScore,
    carryReal: melhor.resultado?.carryReal ?? null,
    technicalScore: entrada.technicalScore,
  });

  // 4) Probability — só quando há histórico de decisões pra julgar.
  const probabilidade = entrada.decisoesAvaliadas ? calcularProbabilidade(entrada.decisoesAvaliadas) : null;

  // 5) Decision — nunca diz compre/venda; resume convicção + qualquer bloqueio do FDIE.
  const bloqueadaPorFdie = resumo.critico > 0;
  const explicacao = bloqueadaPorFdie
    ? `FDIE encontrou ${resumo.critico} verificação(ões) crítica(s) para ${entrada.ticker} — checar a fonte antes de confiar em qualquer nota deste ciclo.`
    : `Confluence ${confluence.score ?? "indisponível"} (${ROTULO_CONVICCAO[confluence.conviccao]}), calculada sobre ${confluence.componentesDisponiveis}/${confluence.componentesTotal} componentes.${
        probabilidade?.probabilidade !== null && probabilidade?.probabilidade !== undefined
          ? ` Histórico: ${probabilidade.explicacao}`
          : ""
      }`;

  return {
    ticker: entrada.ticker,
    fdie: { verificacoes, resumo },
    carry: { degraus, melhor },
    confluence,
    probabilidade,
    decisao: { conviccao: confluence.conviccao, bloqueadaPorFdie, explicacao },
    metodo:
      "Master Decision Engine v1 (Foundation v3) — orquestra FDIE → Carry → Confluence v2 (Fundamentos/Growth/Technical/Macro/Consensus/Management/Portfolio) → Probability (quando há histórico) → Decision. Pendência documentada: os 3 call sites de produção (radar, /api/teses/avaliar, /comparar) ainda calculam nota fora deste fluxo — migração planejada para o Bloco 2. Nunca diz compre/venda.",
  };
}
