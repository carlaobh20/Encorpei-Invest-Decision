# Truth Layer — Bloco 2, Sprint 2.4 (Fase A1)

## O que é

Camada de auditabilidade sobre o que o Encorpei já calcula — não cria
motor de decisão nenhum, só prova que os motores existentes são
confiáveis (ou mostra honestamente onde não são ainda).

## Por que "Fase A1" e não "Sprint 2.4 completa"

A spec original tinha 14 módulos. Três já existiam quase inteiros antes
desta sprint (Data Lineage, via `proveniencia.ts`) ou já tinham decisão
tomada em sprint anterior (Multi-Source Validation, adiada por custo/risco
— ver `auditoria.ts`). Dos 11 módulos genuinamente novos, esta rodada
(Fase A1) entrega os 6 de maior valor pelo menor custo/risco. Fase A2
(Reproducibility, Data Explainer, Public Audit) e Fase B (Multi-Source
Validation, Divergence Center real, Performance/cache) ficam para as
próximas rodadas — ver Pendências.

## Módulos entregues nesta rodada

### Módulo 9 — Missing Data Registry (`src/lib/truth-missing-data.ts`)

Formaliza as lacunas que já eram documentadas ad-hoc (em comentário de
código e no roadmap) num registro único e consultável: `LACUNAS_CONHECIDAS`,
cada uma com dado, categoria, motivo, do que depende, sprint que resolve
(ou `null` se ainda não decidido) e telas afetadas. Quando uma lacuna for
resolvida, a entrada deve ser removida — não fica "resolvido" acumulando.

### Módulo 1 — Data Confidence (`src/lib/truth-data-confidence.ts`)

Selo de 1 a 5 estrelas, regra determinística (nunca IA), combinando:
confiabilidade da fonte, verificações de integridade do FDIE (reaproveita
`auditoria.ts`, não duplica), idade do dado, divergência conhecida (hoje
sempre `false` — Multi-Source Validation não existe ainda, nunca inferido)
e presença de linhagem completa.

### Módulo 2 — Data Lineage (`src/lib/truth-lineage.ts`)

Corte honesto: este módulo já existia quase inteiro (`proveniencia.ts`,
Foundation v3). Este arquivo só adiciona `indicador`/`tabela`/
`motorResponsavel` por composição, sem alterar o tipo congelado do
Foundation.

### Módulo 5 — Data Quality Score (`src/lib/truth-quality-score.ts`)

Agrega os selos de Data Confidence de uma empresa num score 0-100,
penalizado por verificações críticas/alerta do FDIE. `indicadoresDivergentes`
fica sempre 0 — não é "confirmado", é "não medido ainda" (mesmo motivo do
Módulo 1).

### Módulo 6 — Indicator History, parcial (`src/lib/truth-indicator-history.ts`)

Registro de cobertura: Carry/ROIC/Margem/Receita/Lucro têm série real
persistida (mesmo achado da Sprint 2.3); FCF/P-L/EV-EBITDA/P-VP/Dividend
Yield/Confluence não têm — motivo de cada ausência documentado, não
fabricado.

### Módulo 10 — Quality Dashboard (`/auditoria/verdade`)

Painel ao vivo: Data Quality Score por empresa (calculado em cima do
mesmo fetch que `/auditoria` já faz — fundamentos, preços, ações, FDIE),
agregado por setor, mais os registros dos Módulos 6 e 9 lado a lado.

## Módulos NÃO entregues nesta rodada (registrados, não escondidos)

| Módulo | Situação |
|---|---|
| 3 — Reproducibility (árvore "como foi calculado") | Fase A2 — ingredientes existem (proveniência, hash), falta a árvore de exibição. |
| 4 — Multi-Source Validation | Fase B — decisão de custo/risco (API paga ou scraping) que só o Carlos toma; já estava registrada como pendente ANTES desta sprint (`auditoria.ts`). |
| 7 — Data Explainer (painel lateral por indicador) | Fase A2 — precisa de conteúdo estático por indicador + binding com Lineage/Confidence já prontos. |
| 8 — Divergence Center | Depende do Módulo 4. Quando construído, nasce honestamente vazio até o 4 existir. |
| 11 — Public Audit ("Por que confiar?") | Fase A2 — montagem de documentação, baixo risco técnico. |
| 12 — Performance/cache | Adiado por ser prematuro — nada nesta camada ainda faz cálculo caro repetido; construir cache agora seria otimizar o que não existe. |

## Testes

64 arquivos, 517 testes na suíte inteira. Truth Layer especificamente: 6
arquivos novos, 39 testes, 100% statements nos arquivos que não têm
dependência externa transitiva (truth-data-confidence.ts confirmado).

## Autoavaliação crítica — o que ainda falta pra "nível Bloomberg/FactSet/Aladdin"

Sem otimismo: nenhuma dessas plataformas depende de um único conjunto de
fontes gratuitas (CVM + BCB + brapi) sem nenhuma validação cruzada
independente. Elas têm equipe dedicada de dados, múltiplos provedores
pagos redundantes, SLA de atualização, e décadas de histórico. O Encorpei,
hoje:

- **Não tem validação cruzada real** (Módulo 4 não implementado) — todo
  "Data Confidence 5 estrelas" hoje significa "nenhum problema que o
  sistema sabe procurar", não "confirmado por fonte independente". Isso é
  uma diferença de categoria, não de grau.
- **Não tem histórico suficiente pra a maioria dos múltiplos de valuation**
  (Módulo 6) — não dá pra mostrar "como o P/L evoluiu" porque a série
  nunca foi persistida.
- **Depende de fontes gratuitas sem SLA** — CVM/BCB podem mudar formato
  sem aviso; não há contrato de disponibilidade.
- **Não tem processo de correção formal** — quando um dado vem errado
  (como o bug de escala do ROIC da INTB3, já documentado em `auditoria.ts`),
  a correção é manual, não um fluxo de "reportar → investigar → corrigir →
  reauditar" com trilha própria.

O que o Encorpei tem que boa parte do mercado de varejo não tem: proveniência
real em cada número (hash, fonte, timestamp), imutabilidade de evento/decisão,
FDIE verificando consistência interna todo dia, e agora (a partir desta
sprint) um registro explícito do que ainda não é verdade auditável. Isso é
a fundação certa para chegar lá — não é, ainda, estar lá.

## Pendências (ordem sugerida)

1. Fase A2: Reproducibility (Módulo 3), Data Explainer (Módulo 7), Public
   Audit (Módulo 11).
2. Decisão do Carlos sobre Multi-Source Validation (Módulo 4) — fonte paga
   ou scraping, aceitar o risco de manutenção.
3. Decidir se persiste séries diárias de P/L, EV/EBITDA, P/VP (destrava
   Módulo 6 nesses 3 indicadores sem depender de fonte nova).
