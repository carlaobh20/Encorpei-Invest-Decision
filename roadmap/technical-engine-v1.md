# Technical Intelligence Engine v1 — metodologia, decisão de escopo, e o que ficou de fora

**O que é:** o Technical Score lê o gráfico para responder QUANDO agir
sobre uma tese que já existe — nunca O QUE comprar. O Encorpei não é um
software de análise técnica nem de análise fundamentalista isolados: é um
software de DECISÃO. Fundamentos continuam decidindo O QUE. O gráfico
nunca aprova sozinho uma empresa ruim, e o sistema NUNCA diz
"compre"/"venda" (regra 7 do CLAUDE.md, com trava no CI) — só "Momento
Favorável", "Momento Desfavorável" ou "Aguardar melhor ponto".

## Decisão de escopo (registrada, porque foi minha, não do Carlos)

Carlos pediu para eu decidir o melhor caminho e depois implementar a
especificação (20+ seções). Antes de construir, chequei o que o sistema
tem hoje:

- **~60-300 candles diários por ticker**, coletados só a partir da brapi
  (confirmado via SQL: `precos_diarios` tem histórico curto, sem qualquer
  candle semanal/mensal próprio). A hierarquia de timeframe pedida na spec
  original — Semanal 60% / Mensal 30% / Diário 10% — é matematicamente
  impossível hoje: não existe candle semanal ou mensal coletado, só diário.
  Fica para v2 (quando houver profundidade e agregação semanal/mensal).
- **Sem OHLC real até esta sessão** — `precos_diarios` só guardava
  fechamento/volume/market_cap; a brapi sempre devolveu open/high/low no
  payload bruto, mas isso não estava sendo persistido. Corrigido primeiro
  (migração 018, ver abaixo) porque sem máxima/mínima reais não dá pra
  calcular ATR nem Bollinger de verdade — só aproximação por fechamento,
  que eu não quis entregar como se fosse dado real.
- **Nenhum mecanismo de snapshot diário de score técnico** — mesma limitação
  já documentada no Compounder Engine: sem histórico gravado dia a dia, não
  existe "timeline de entrada/saída" nem "dashboard de mudança de score" —
  só o valor calculado NA HORA.
- **Padrões gráficos nomeados** (triângulos, bandeiras, ombro-cabeça-ombro,
  topo/fundo duplo, cup-and-handle) exigem curadoria visual — a própria
  spec do Carlos disse "nunca decidir sozinho" sobre eles. Detecção
  automática confiável desses padrões é um projeto à parte, não uma função
  pura como o resto do motor.
- **Regra 7 do CLAUDE.md, com trava no CI**: proibido "compre"/"venda". O
  Timing Engine e a Tese Técnica foram desenhados desde o início só com os
  rótulos permitidos.

Por isso, esta v1 entrega: (1) a correção de dado que faltava (OHLC real),
(2) os indicadores técnicos padrão como funções puras testadas, (3) um
Technical Score de 5 componentes com corte honesto, (4) um Confluence
Engine juntando Fundamentos+Carry+Compounder+Technical, (5) a interface
`MarketDataProvider` pronta mas ainda não conectada ao pipeline de
produção, e deixa de fora — de forma explícita — tudo que dependeria de
inventar dado, de mais profundidade histórica que ainda não existe, ou de
tocar no pipeline de produção sem necessidade.

## Migração 018 — OHLC real (pré-requisito, já aplicada em produção)

`precos_diarios` ganhou `abertura`, `maxima`, `minima` (colunas aditivas,
nullable — nada quebra). Backfill histórico feito lendo o próprio
`dados_brutos.payload` já salvo (nenhum dado novo inventado, é o mesmo
payload que o sistema já tinha) — confirmado 2520/2520 linhas, 40/40
tickers com dado completo. `route.ts` (coleta diária) passou a persistir
essas três colunas dali pra frente, tanto no backfill histórico quanto na
cotação do dia.

## O Technical Score (0-100)

Score = média ponderada dos componentes com dado disponível, peso dos
componentes faltantes redistribuído entre os disponíveis (nunca um buraco
vira nota inventada). Escala: 0 = viés de baixa forte, 50 = neutro, 100 =
viés de alta forte.

| # | Componente | Peso | Como é calculado nesta v1 |
|---|---|---|---|
| 1 | Tendência | 30% | Alinhamento de MM9/MM21/MM72 (com MM72 opcional — nem todo ticker tem 72 pregões ainda) + inclinação da MM21 nos últimos 10 pregões + há quanto tempo o cruzamento MM9×MM21 está em vigor |
| 2 | Momentum | 25% | RSI(14) de Wilder + histograma do MACD(12,26,9) normalizado pelo preço + ROC(21), combinados (média dos disponíveis) |
| 3 | Volume | 15% | Volume do último pregão vs. média de 20 pregões + inclinação do OBV nos últimos 10 pregões |
| 4 | Estrutura de mercado | 15% | Pivôs locais (topo/fundo, janela de confirmação) — classifica alta (topos e fundos ascendentes), baixa (descendentes) ou lateral |
| 5 | Rompimentos | 15% | Preço vs. suporte/resistência mais recente (dos pivôs), com confirmação por volume ≥1,3x a média — rompimento "confirmado" vs. "fraco" |

Confiança do score: `alta` se ≥70% do peso total veio de componentes com
dado real, `media` se ≥40%, `baixa` abaixo disso. Fórmulas exatas em
`src/lib/technical/v1.ts` (score) e `src/lib/technical/indicadores.ts`
(indicadores puros, 16 testes) — cada faixa está documentada no código,
versionada.

**ATR(14) e Bollinger(20,2) são calculados e mostrados na página de cada
empresa, mas ficam FORA do Technical Score nesta v1** — são informativos
para leitura de volatilidade, ainda não calibrados como componente de
nota. ADX e Estocástico ficam de fora do Momentum Engine (RSI+MACD+ROC já
formam um score renormalizável; adicionar mais dois indicadores sem
recalibrar os demais só adicionaria ruído).

## Timing e Tese Técnica

Timing: Excelente (≥80) / Bom (≥60) / Neutro (≥40) / Ruim (≥20) / Muito
ruim (<20) → nunca vira instrução de ordem, só a frase "Momento
Favorável"/"Momento Desfavorável"/"Aguardar melhor ponto" (testado: a
frase nunca contém "compre" nem "venda", `v1.test.ts`).

Tese Técnica ("o gráfico confirma a tese?"): SIM (score ≥70) /
PARCIALMENTE (40-69) / NÃO (<40) / SEM_TESE (quando não há tese
fundamentalista registrada para o ticker, ou quando não há dado técnico
suficiente). Nunca aprova uma tese sozinha — só diz se o timing técnico
está alinhado com uma tese que os fundamentos já sustentam ou não.

## Confluence Engine v1 (`src/lib/confluencia.ts` + `confluencia-dados.ts`)

Um dos "principais indicadores" pedidos na spec: combina os 4 motores que
já existem numa nota 0-100 + rótulo de Convicção (Alta/Moderada/Baixa/
Indefinida).

| Componente | Peso | Fonte |
|---|---|---|
| Fundamentos | 30% | Score Final do Radar (réguas versionadas por modelo setorial) |
| Carry | 20% | Carry real (IPCA+X% a.a.), mapeado para 0-100 |
| Compounder | 25% | Compounder Score v1 |
| Technical | 25% | Technical Score v1 (este documento) |

**Macro, Fluxo (institucional/estrangeiro) e Gestão ficam DE FORA da soma**
— não são "peso zero disfarçado", são ausência documentada: Macro existe
como CONTEXTO (Focus/Selic/CDI/IPCA, sensibilidade à Selic do Compounder)
mas não é um score comparável entre empresas; Fluxo não tem fonte de dado
coletada; Gestão tem o mesmo buraco já documentado no Compounder Engine
(sem proxy honesto hoje). Os 4 pesos acima somam 100% sozinhos, sem
esses três.

## MarketDataProvider — preparação para o futuro (não implementado ainda)

`src/lib/mercado/provider.ts` define a interface (`MarketDataProvider`)
e uma implementação de referência (`BrapiProvider`) — exatamente como
pedido: "nunca criar dependência direta de uma única plataforma". Esta
interface **NÃO está conectada** ao `route.ts` de coleta em produção. O
motivo: `route.ts` roda em cron automático todo dia útil, é produção
funcionando — trocar seu fetch direto pela interface no meio desta sessão
arriscaria o pipeline sem necessidade nenhuma hoje (não há uma segunda
fonte real para justificar a troca ainda). Quando existir uma fonte
profissional de verdade, o trabalho vira: implementar `MarketDataProvider`
para ela e trocar uma linha no `route.ts`, sem tocar no resto do sistema.

O módulo **Encorpei Market Digital Twin**, citado na especificação como
"não implementar ainda", não foi tocado — nem a arquitetura de preparação
foi além da interface acima, que já é suficiente para permitir a troca de
fonte quando chegar a hora.

## O que ficou de fora — e por quê (não é esquecimento)

- **Hierarquia de timeframe Semanal(60%)/Mensal(30%)/Diário(10%)**: sem
  candle semanal/mensal coletado (ver Decisão de escopo acima). v2.
- **Padrões gráficos nomeados** (triângulos, bandeiras, OCO, cup-and-handle,
  topo/fundo duplo): exigem curadoria visual — a própria spec pediu
  "nunca decidir sozinho" sobre eles. Fora desta v1.
- **ADX, Estocástico**: fora do Momentum Engine nesta v1 (ver acima).
- **Backtest e Simulador**: mesma razão do Compounder — profundidade
  histórica de preço curta demais para simular estratégias com significado.
- **Timeline / Dashboard de entrada-saída**: sem snapshot diário gravado
  de score técnico, não existe "ontem" para comparar — mesma limitação já
  documentada no Compounder.
- **Encorpei Market Digital Twin**: instrução explícita do Carlos para não
  implementar ainda — só a interface `MarketDataProvider` foi preparada.
- **Reescrita de `route.ts` para usar `MarketDataProvider`**: decisão
  deliberada de não tocar o pipeline de produção sem necessidade concreta
  (ver seção acima).

## Versionamento

`TECHNICAL_CONFIG.versaoVigente = 1` (`src/lib/technical/types.ts`).
Confluence Engine é v1 sem número de versão próprio ainda declarado no
tipo — a acompanhar quando o Technical ou o Compounder mudarem de versão.
Mudar peso ou fórmula de um componente = nova versão, nunca editar a v1
por baixo — mesma regra do Carry Engine e do Compounder Engine.
