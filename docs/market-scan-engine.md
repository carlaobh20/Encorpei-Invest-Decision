# Market Scan Engine — Bloco 2, Sprint 2.10 (Fase A1)

## O que é

"O que realmente mudou desde ontem?" — um cron diário novo
(`/api/market-scan/executar`) que orquestra tudo que já existe (Radar,
Decision Object, Status de Tese, Compounder, Carry) e produz 3 saídas:
eventos de mudança, uma fila de oportunidades classificada, e 8
watchlists automáticas. Nenhum motor novo — cada etapa chama uma função
já exportada de outro lugar.

## Inventário honesto feito ANTES de codar (a parte mais importante desta sprint)

A spec pede comparar "ontem vs hoje" em 13 dimensões. Antes de escrever
qualquer linha, chequei o que realmente é possível comparar hoje:

| Dimensão | Fonte histórica real hoje? | Onde |
|---|---|---|
| Tese | **Sim** | `eventos_tese` (migração 004, já real, já alimenta os Alertas do Meu Dash) |
| Carry (v1) | **Sim** | `carry_score`, gravado todo dia útil desde antes do Bloco 2 |
| Quality (proxy) | **Sim** | tendência de ROIC via `fundamentos` (mesmo limiar de `memory-layer-resultados.ts`) |
| Growth, Portfolio Fit, Convicção, Técnica | **Não** — nenhum é persistido diariamente | precisa da migração 024 (`decision_snapshot_diario`, escrita nesta sprint, NÃO aplicada — mesmo bloqueio Supabase de 022/023) |
| Guidance, Governança, Controlador, Macro | **A fonte existe** (`evidencias`, migração 021, aplicada) **mas está vazia** — o coletor (`/api/evidencias/coletar`) nunca rodou agendado em produção (migração 023 também não aplicada) | pendente de 023 aplicada + 1ª coleta |
| Fluxo | **Não, nenhuma fonte** | exatamente como a spec previu — "estrutura preparada" |
| Dividendos | **Não, nenhuma fonte** | confirmado por busca no código (Sprint 2.9) — sistema nunca rastreou proventos |

Isso significa: Change Detection entrega HOJE, com dado real, só tese +
Carry v1 + Quality-proxy. As outras 10 dimensões têm o comparador PRONTO E
TESTADO (`market-scan-change-detection.ts`), mas devolvem
`disponivel: false` com o motivo explícito até as migrações/coletores
represados serem destravados — nunca uma direção fabricada.

## Quase um erro repetido (registrado, mesma lição do Sprint 2.9)

Ao montar o Capital Allocation (Sprint 2.9) quase dupliquei um motor já
existente. Desta vez, antes de escrever `capital-allocation-simulacao.ts`
de novo por engano, o processo já estava mudado: primeiro chequei o que
`montarDecisions`/`calcularRadar`/`montarStatusTeses`/`calcularCompounders`
já entregam, e o Market Scan Engine só chama essas funções — não recalcula
nada. A lição do Sprint 2.9 (checar a Fila do Carlos e o inventário real
antes de codar) foi aplicada aqui desde o início, não descoberta no meio.

## Módulos entregues (Fase A1)

1. **`market-scan-config.ts`** — todo limiar usado pelos módulos abaixo
   num só objeto nomeado e documentado. "Configurável" nesta rodada
   significa isso — num só lugar, fácil de revisar — não configurável em
   tempo de execução via banco/interface (exigiria tabela + tela novas,
   registrado como pendência).
2. **`market-scan-change-detection.ts`** (Módulo 2) — comparadores puros
   para as 13 dimensões, cada um testado, cada um honesto sobre
   disponibilidade (ver tabela acima).
3. **`opportunity-engine.ts`** (Módulo 3) — 5 níveis (Oportunidade → Boa →
   Forte → Rara → Excepcional), NUNCA só a nota de Confluence: Rara/
   Excepcional exigem Carry real acima de um piso E pelo menos uma mudança
   positiva detectada; FDIE crítico sempre rebaixa, mesmo com os outros
   sinais fortes.
4. **`market-watchlists.ts`** (Módulo 4) — as 8 listas pedidas, compostas
   sobre Status Derivado da Tese (`thesis-engine.ts`), Compounder Score,
   Carry, Quality/Growth, comparação setorial (`dash-narrativa.ts`) e
   market cap. "Novos Compounders" está rotulado "Compounders hoje" —
   rastrear quem é REALMENTE novo depende da mesma migração 024.
5. **`market-radar.ts`** (Módulo 5) — agregação do painel "hoje" a partir
   dos módulos 2-4, nenhum cálculo próprio.
6. **`/api/market-scan/executar`** — cron novo (`vercel.json`, 23h45,
   dias úteis, depois do `/api/teses/avaliar` das 23h30), roda o pipeline
   completo sobre o universo inteiro (`calcularRadar`), tenta gravar o
   snapshot diário (migração 024 — falha graciosamente se a tabela não
   existir ainda, não derruba a execução) e devolve um resumo estruturado
   (tempo, empresas processadas, mudanças detectadas/indisponíveis,
   oportunidades, falhas) — satisfaz "Logs" sem precisar de mais uma
   tabela nova.
7. **Meu Dash** — bloco "Market Scan" com exatamente 3 oportunidades + 3
   riscos + 3 mudanças da carteira (nunca a lista inteira), reaproveitando
   `ameacasCarteira` (Sprint 2.8) e o Opportunity Engine sobre `decisions`
   (já montado pra carteira inteira desde a Sprint 2.1).
8. **Decision Center** — seção "Mudanças Detectadas", consumindo o MESMO
   `detectarMudancaTese` sobre o MESMO `eventos_tese` que a tela já lia
   pros Alertas — literalmente "nunca recalcula", reusa a função pura.

## O que NÃO foi entregue nesta rodada, registrado

- **Migração 024 aplicada** — escrita, mesmo bloqueio Supabase de 022/023
  (agora 3 migrações empilhadas atrás dele, sem contar a 025/026
  hipotéticas de Meta Patrimonial/Decision History dos sprints anteriores).
- **Coletor de evidências agendado + primeira coleta** — sem isso,
  Guidance/Governança/Controlador/Macro continuam sem dado pra comparar,
  mesmo com a tabela `evidencias` já existindo.
- **Funil configurável via banco/interface** — hoje é config-no-código
  (item acima), não uma tela onde o Carlos edita limiares sem redeploy.
- **Página própria de Market Radar** — o painel virou um bloco dentro de
  Meu Dash, não uma tela nova (`/radar-mercado` ou similar) — cabe no
  roadmap do Product Layer (Research Lab/Replay/Sistema como telas
  próprias, já registrado antes desta sprint).
- **Replay — registro automático de TODA mudança relevante** — só a
  dimensão tese (via `eventos_tese`, que o Replay já deveria conseguir
  ler) foi conectada; as outras 12 dimensões, quando tiverem dado real,
  precisam de um formato de evento genérico — hoje `eventos_tese` só
  aceita os tipos que a migração 004 definiu, não comporta "Carry mudou
  X%" como um tipo novo sem alterar Foundation (proibido nesta sprint).
- **Research Lab — armazenamento de oportunidades** — a spec quer
  "armazenar pra estudos futuros". A migração 019 (ERL) documenta
  EXPLICITAMENTE que o schema `erl.*` é isolado da produção ("nenhuma
  tabela de produção é lida ou escrita por aqui") e `erl.hipoteses` é uma
  estrutura de hipótese testável (metodologia/significância estatística),
  não um registro de oportunidade bruta — a própria spec desta sprint
  também diz "nenhuma hipótese será criada". Guardar oportunidades cruas
  no ERL do jeito errado seria pior que não guardar — fica como decisão
  pendente (schema novo dedicado, ou uma tabela de produção própria).
- **Risco de infraestrutura, não registrado antes:** `vercel.json` agora
  tem 3 crons. Não tenho como confirmar, sem acessar o painel da Vercel,
  se o plano atual do projeto permite 3 (os 2 anteriores já rodavam) —
  Carlos, vale conferir no painel da Vercel se o 3º cron (`market-scan/
  executar`, 23h45) realmente ativou depois do deploy.

## Testes e cobertura

687 testes na suíte inteira (85 arquivos), 45 novos desta sprint.
Cobertura MEDIDA (não estimada) nos 5 módulos puros novos via `vitest run
--coverage`: **97.34% statements, 94.89% branches, 100% functions, 98.9%
lines** — abaixo do pedido apenas em branches (94.89% vs 95%), por 7
branches não cobertas em casos-limite de baixo risco (ex.: combinações
raras de `null` em `opportunity-engine.ts`). `npx tsc --noEmit` limpo.
ESLint limpo (só os 3 erros pré-existentes de `Date.now()` em `page.tsx`,
confirmados via `git diff` como não tocados nesta sprint). `npm run build`
limpo, rota `/api/market-scan/executar` aparece no build.

## Autoavaliação obrigatória

**"Se amanhã monitorarmos 10.000 ativos em 30 bolsas diferentes, quais
gargalos arquiteturais ainda existem e como eliminá-los?"**

Respondendo sem defender a arquitetura atual:

1. **Execução síncrona, single-request, single-worker.** O cron roda tudo
   num único `GET` de até 60s (`maxDuration`) — hoje cobre ~11-20
   empresas confortavelmente. Com 10.000 ativos isso precisa virar
   processamento distribuído: fila de jobs (um job por ativo ou por lote),
   workers paralelos, sem depender de uma única invocação de função
   serverless terminar a tempo.
2. **"Incremental" hoje é conceitual, não estrutural.** Esta rodada roda
   o universo inteiro a cada execução (só ~20 empresas, então é barato).
   Em 10.000 ativos, "nunca recalcular todo o universo quando só um
   mudou" exige checkpointing REAL por ativo — saber, antes de processar,
   quais 50 dos 10.000 tiveran dado novo desde a última execução (via
   timestamp de última atualização por fonte), e processar só esses.
3. **Uma única instância de Postgres (Supabase free tier) não escala pra
   30 bolsas.** Fuso horário, calendário de pregão e latência de fonte de
   dado variam por bolsa — precisaria de sharding por região/timezone e,
   provavelmente, mover o armazenamento operacional (não o histórico) pra
   algo mais adequado a escrita em lote de alta frequência.
4. **`evidencias`/`decision_snapshot_diario` como tabelas únicas, sem
   particionamento.** Com 10.000 ativos × 365 dias, uma tabela não
   particionada (por data ou por bolsa) fica lenta pra consultar "ontem
   vs hoje" rapidinho — precisaria particionar por data desde o desenho,
   não como retrofit depois.
5. **Nenhuma fila de mensagens/eventos.** Hoje "gerar um evento" é
   literalmente "calcular e devolver no JSON da resposta". Numa escala
   maior, cada mudança detectada precisaria publicar num barramento de
   eventos real (mesmo que simples) pra Decision Center/Replay/Meu Dash
   consumirem de forma assíncrona, em vez de recalcular a cada
   carregamento de página como o Meu Dash/Decision Center ainda fazem
   hoje pra tese.
6. **O bloqueio de conector Supabase, hoje um incômodo, viraria
   inviabilizante.** Aplicar migração via SQL Editor manual não escala pra
   um pipeline de produção real — a essa escala, migrações precisam de
   CI/CD de verdade, sem depender de um humano logado num navegador.

Nenhum desses 6 pontos é resolvido nesta sprint — a arquitetura atual é
correta e barata (~R$0/mês) para o tamanho real de hoje (uma pessoa, ~20
empresas, 1 bolsa). Escalar 500x exigiria repensar quase toda a camada de
execução e armazenamento, não só adicionar mais código em cima do que
existe.

## Pendências (ordem sugerida)

1. Resolver o bloqueio de conector Supabase — agora bloqueia migração 024
   (Market Scan) além de 022/023.
2. Aplicar migração 023 + rodar `/api/evidencias/coletar` pelo menos uma
   vez — destrava Guidance/Governança/Controlador/Macro no Change
   Detection.
3. Confirmar no painel da Vercel se o 3º cron ativou.
4. Decidir onde armazenar oportunidades para o Research Lab (schema ERL
   dedicado vs tabela de produção própria).
5. Decidir se vale um Market Radar como tela própria (Fase A2) em vez de
   bloco dentro de Meu Dash.
6. Decidir formato de evento genérico para o Replay registrar mudanças
   além de tese (exigiria alterar `eventos_tese` ou criar uma tabela
   nova — qualquer uma das duas é uma decisão de escopo, não implícita).
