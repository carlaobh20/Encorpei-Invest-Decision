# Investment Coach Layer — Bloco 2, Sprint 2.7 (Fase A1)

## O que é

Camada de ensino — não cria motor, não cria indicador, não altera
Foundation/Truth Layer/Memory Layer/notas/cálculos. Toda inteligência já
existe (Explanation Engine, Confluence, radar, FDIE, urgência do Decision
Center); esta sprint traduz o que já é calculado em lição, não em número
novo.

## Nota sobre a numeração

O brief chegou como "Sprint 2.7", pulando a 2.6 (a última entregue foi a
2.5, Simplicity Layer). Não decidi por conta própria criar uma "Sprint
2.6" retroativa nem preencher a lacuna — segui o número que o Carlos deu,
registrado aqui pra não confundir quem ler o histórico depois.

## Por que "Fase A1" de novo, e não a sprint inteira

Mesmo racional das 3 sprints anteriores do Bloco 2 (Memory/Truth/
Simplicity Layer): "revisar todas as telas implementadas" com 7 módulos
novos (componente + insights + thesis lessons + decision lessons +
cápsulas + biblioteca de erros + integração em 5 telas) de uma vez é
redesign, não sprint. Esta rodada entrega o TOOLKIT inteiro e aplica em
2 telas de referência (Empresas e Decision Center) — as que a própria
spec cita nominalmente pra Thesis Lessons e Decision Lessons.

## Módulos entregues

1. **Coach Insights** (`src/lib/coach-insights.ts` + `erros-classicos.ts`)
   — regra pura, devolve NO MÁXIMO um insight, nunca uma lista. Prioridade:
   erro clássico detectado > ROIC caiu (variação ≥10% negativa entre as 2
   últimas competências DFP, mesmo limiar de `memory-layer-resultados.ts`)
   > Carry acima da média do setor (mesmo comparador transversal de
   `dash-narrativa.ts`, Sprint 2.1) > P/L muito baixo isolado (earnings
   yield ≥12%, mesmo breakpoint de `score.ts`). Os 3 textos literais da
   spec (Carry elevado/ROIC caiu/P-L muito baixo) estão exatamente como
   pedidos.
2. **Biblioteca de Erros Clássicos** (`erros-classicos.ts`) — os 5 erros
   da spec. 4 têm matcher real sobre `Decision.quality/growth/technical`
   (0-100, já calculados) + earnings yield (radar). "Olhar apenas Dividend
   Yield" fica SEM matcher — o sistema não calcula DY em lugar nenhum hoje
   (confirmado, ver `truth-indicator-history.ts`); fica na biblioteca como
   conteúdo educativo, nunca relacionado a um caso que o sistema não pode
   verificar.
3. **Thesis Lessons** (`thesis-lessons.ts`) — as 2 primeiras perguntas
   reaproveitam `InvestmentStory.oQueFortalece`/`oQueEnfraquece` (Sprint
   2.2, zero reprocessamento). A terceira ("o que diferencia dos
   concorrentes") usa o MESMO comparador setorial transversal do Coach
   Insight, aplicado a ROIC e Carry — sem comparação de setor disponível,
   resposta honesta ("—" com motivo), nunca inventada.
4. **Decision Lessons** (`decision-lessons.ts`) — "por que apareceu" é
   sempre o `motivo` real que `classificarUrgencia` já produz. "Conceito
   que ensina" é uma tabela de tradução FECHADA sobre os 7 títulos que
   `classificarUrgencia` pode gerar (união exaustiva) — tradução
   determinística de um conjunto fechado, não inferência nova.
5. **Intelligence Capsule** (`intelligence-capsule.ts`) — Resumo/Por que
   importa/Oportunidade/Risco vêm de `InvestmentStory`. Nível de confiança
   reaproveita `Decision.fdie` (já usado nos alertas desta mesma tela) —
   deliberadamente NÃO é o Data Quality Score 0-100 do Truth Layer (que
   exigiria replicar a consulta de `/auditoria/verdade` nesta página);
   é um sinal mais simples e honesto ("o FDIE achou problema hoje?").
   "Preciso agir?" reaproveita a urgência já classificada, não inventa
   nova.
6. **Componentes reutilizáveis**: `InvestmentCoach.tsx` (insight único,
   discreto, `null` não renderiza nada) e `IntelligenceCapsuleCard.tsx`.

## Aplicação de referência

- **Empresas** (`/tese/[ticker]`) — nova Seção 1.5 "O que aprendemos com
  esta empresa?": 1 Coach Insight + as 3 perguntas do Thesis Lessons +
  1 Intelligence Capsule.
- **Decision Center** (`/decisoes`) — 1 Coach Insight no topo da tela
  (tirado do ticker de maior prioridade hoje, ou da melhor oportunidade se
  não houver decisão prioritária) + Decision Lessons ("por que apareceu"/
  "o que ensina") sob cada card de Decisão Prioritária.

## O que NÃO foi entregue nesta rodada (registrado, não escondido)

- **Replay como professor** (`/tese/[ticker]`, Seção 11) — a spec pede
  "qual hipótese foi confirmada, qual foi rejeitada" por evento. Isso
  exige a tabela `tese_estrutura` (tipo `hipotese`, migração 022) — que
  segue **NÃO aplicada** no banco em produção (mesmo bloqueio do Supabase
  MCP já registrado desde a Sprint 2.2). Sem essa tabela não existe
  hipótese real pra confirmar ou rejeitar — não fabriquei. Assim que a
  migração 022 for aplicada, este módulo é código novo relativamente
  pequeno sobre dado que passa a existir.
- **Aprendizados da Carteira** — mecanismo é viável SEM migração nova
  (posições já têm `data_compra`, migração 016 aplicada; `portfolio-health.ts`
  já calcula concentração por modelo/setor) — comparar a carteira
  filtrando posições antes/depois da data de entrada de uma posição
  específica é código novo, não bloqueado, só não coube nesta rodada.
  Fase A2.
- **Coach Insight em Meu Dash e Research Lab** — toolkit já pronto pra
  isso (mesma função `gerarCoachInsight`), só falta escolher o sinal certo
  por tela e aplicar. Fase A2.
- **Integração em todas as 5 telas simultaneamente** — mesma decisão de
  escopo do Simplicity Layer (Sprint 2.5): 2 telas de referência bem
  feitas em vez de 5 rasas.

## Autoavaliação crítica — "O Encorpei está ensinando ou apenas mostrando dados?"

**Resposta honesta: as duas coisas, dependendo da tela — hoje ensina em 2
das ~9 telas do produto, mostra dado nas outras 7.**

Onde ensina de verdade: Empresas e Decision Center agora respondem, além
do "o quê", o "por que isso importa" e "o que fazer com essa informação
da próxima vez" — Thesis Lessons força uma resposta pra "o que diferencia
essa empresa" mesmo quando a resposta honesta é "não temos comparação
hoje", e Decision Lessons liga cada decisão prioritária a um conceito de
investidor reutilizável, não só ao evento que a disparou.

Onde ainda só mostra dado: Meu Dash, Research Lab, Replay, Carteira,
Truth Layer e Memory Layer não ganharam nenhuma camada de ensino nesta
rodada — continuam exatamente como estavam (números, badges, tabelas,
sem "e daí"). Meu Dash em particular é a porta de entrada do sistema e é
onde mais faria diferença ter um Coach Insight — não ter chegado lá ainda
é a lacuna mais importante desta sprint.

Segunda limitação honesta: mesmo nas 2 telas que ganharam a camada, o
Coach Insight só dispara quando um sinal real cruza um limiar (erro
clássico, queda de ROIC, Carry acima do setor, P/L muito baixo) — pra
boa parte das empresas, num dia qualquer, nenhum desses sinais está
ativo, e o insight simplesmente não aparece (`null`, por design — nunca
um texto genérico de preenchimento). Isso é o comportamento certo pra
não inventar ensino onde não há sinal, mas significa que "o usuário
sempre sai sabendo mais do que entrou" (critério de validação da spec)
ainda não é verdade pra toda visita a essas 2 telas — só quando há sinal.

## Testes

73 arquivos, 577 testes na suíte inteira. Investment Coach Layer
especificamente: 5 arquivos novos, 31 testes.

## Pendências (ordem sugerida)

1. Aplicar migração 022 (`tese_estrutura`) — destrava Replay como
   professor (hipóteses confirmadas/rejeitadas), item que já bloqueava
   outras funcionalidades desde a Sprint 2.2.
2. Coach Insight em Meu Dash — maior tráfego, maior ganho.
3. Aprendizados da Carteira — sem bloqueio de dado, só falta implementar.
4. Coach Insight + lições em Research Lab e Replay.
