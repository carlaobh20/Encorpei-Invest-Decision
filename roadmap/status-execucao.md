# Encorpei Invest — Status de execução

Atualizado em 03/08/2026 ~21h (Home "Meu Patrimônio" redesenhada — visual dark glass premium, hierarquia fixa 01→07 pedida pelo Carlos, todo número real — no ar · Carteira ganha botões editar/excluir por posição — no ar · PIN removido do Diário E da Carteira (Vercel Authentication já protege o domínio) — no ar · ERL (Research Lab): Fase 1 arquitetura + governança, migração 019 aplicada — no ar · Carry Engine: níveis 2-3 (Growth/Cash) destravados + legenda + leitura automática — no ar · PIC 01 Fase 1.5: Diário ganha histórico de acertos/erros — no ar · Auditoria de dados corrigida e no ar · 11 teses ratificadas · FDIE Fase 1 no ar · Compounder Engine v1 no ar · Technical Intelligence Engine v1 no ar).

## NOVO (03/08 ~21h): HOME "MEU PATRIMÔNIO" REDESENHADA — VISUAL DARK GLASS PREMIUM ✅ NO AR
Carlos mandou uma especificação completa de redesign (inspiração Bloomberg/
Koyfin/BlackRock Aladdin/Apple) com um mockup em screenshot já pronto
visualmente, e pediu "faça da maneira que está na foto". Achado crítico
antes de construir: os números do mockup eram TODOS placeholders inventados
(patrimônio R$990.602 contra o real R$1,24M da carteira agora; Sharpe 1,34;
Confluence 92; Carry "IPCA+11,4%"; tickers de exemplo TM53/CXSE3/ENBR3) —
replicar isso literalmente violaria a regra de fundação do projeto (nunca
número decorativo). Decisão: reproduzir o ESTILO e a HIERARQUIA do mockup
(01 Patrimônio → 02 Performance → 03 Minha Carteira → 04 Oportunidades →
05 Alertas → 06 IA → 07 Empresas, nessa ordem fixa), mas com cada número
vindo de cálculo real — nunca copiando os valores da imagem.

Implementado (delegado a subagente, revisado e verificado por mim antes do
push): fundo dark #07111E "glass" em `Shell.tsx` (aplicado a todas as
páginas); gráfico principal novo (`GraficoPatrimonio.tsx`, SVG client-side
sem lib nova) com abas de período (1M/3M/6M/12M/24M/5A/desde o início) e
tooltip por proximidade de mouse — testado ao vivo, mostra "—" honesto
quando um benchmark não tem dado naquele ponto, nunca interpola; Sharpe já
existia, ganhou dois vizinhos sob o MESMO gate honesto (aporte único + 20
pregões): **Sortino** (downside deviation) e **Volatilidade anualizada**
(`patrimonio.ts`); **Confluence médio da carteira** novo, ponderado por
peso com cobertura reportada (`portfolio-health.ts`,
`confluenciaMediaPonderada`). Nenhuma funcionalidade antiga foi removida —
Decision Feed, Radar, Universo por nota, Diário, cenário macro Focus, tudo
continua, só reorganizado na nova hierarquia.

GATED por falta de dado honesto (documentado na própria tela, não
escondido): deltas diários tipo "Carry médio ↑0,4%" do mockup — dependem
de snapshot histórico dia-a-dia que ainda não existe (fora de escopo de
propósito, pra não colidir com o gatilho das 20h58 sobre
`api/teses/avaliar/route.ts`); a seção Alertas mostra só o que já é
comparável hoje (gatilhos 24h, mudanças de status 24h, delta de nota
média) com nota explícita de que o histórico começa a acumular hoje à
noite. Novos tickers no Radar nas últimas 24h também ficou de fora (exigiria
snapshot diário do Radar, que não existe).

tsc + vitest (167/167, 7 testes novos) + build limpos, commit `7193a67`,
verificado ao vivo: patrimônio real R$1.242.602,50, gráfico com dado real
(queda de -32,5% refletida corretamente), Confluence médio 57 (cobertura
9/9), tooltip do gráfico funcionando com "—" honesto onde falta benchmark.

## NOVO (03/08 ~20h35): CARTEIRA — BOTÕES EDITAR/EXCLUIR POR POSIÇÃO (pedido do Carlos) ✅ NO AR
Carlos reportou: depois de registrar uma posição em `/carteira`, não
dava pra fazer nada com ela — sem jeito visível de editar ou excluir.
Na prática, as duas ações já existiam (reenviar o mesmo ticker
ATUALIZA a posição; quantidade 0 REMOVE), mas dependiam de saber a
regra escondida e redigitar tudo do zero — falha de descoberta na
interface, não de funcionalidade.

Corrigido com um componente cliente novo (`AcoesPosicao.tsx`) por
linha da tabela: botão "editar" preenche o formulário à esquerda com
ticker/quantidade/preço/data da linha clicada (só JS no navegador, não
toca o banco); botão "excluir" envia quantidade=0 pro mesmo server
action que já apagava, com uma confirmação (`confirm()`) antes de
enviar pra evitar clique acidental. tsc + vitest (160/160) + build
limpos, commit `632818c`, testado ao vivo: clique em "editar" na linha
do VALE3 preencheu o formulário corretamente e rolou a tela até ele.
"Excluir" não foi clicado em produção pra não apagar posição real do
Carlos — a lógica é a mesma que já existia e já era usada (linha
INTB3 tem "válida" há tempo, prova que o upsert por ticker funciona).

## ESTADO DAS FASES
- Fase 0 ✅ · 1 ✅ · 2.5 ✅ · 3 ✅ · Fase 7 adiantada
- Fase 2: 11 teses RATIFICADAS ✅ · Fase 4 ✅ · Fase 5 em curso (1ª decisão ABEV3)
- Segurança ✅ · Qualidade ✅ (160 testes + CI)

## NOVO (03/08 ~20h15): ENCORPEI RESEARCH LAB (ERL) — FASE 1: ARQUITETURA + GOVERNANÇA ✅ NO AR (decisão registrada em `roadmap/erl-fase1-v1.md`)
Carlos mandou a especificação completa do ERL (19 camadas: banco
histórico temporal, Time Machine sem look-ahead bias, Feature Store,
motores de descoberta de padrão/poder preditivo/probabilidade,
otimização de pesos, detecção de regime, etc. — filosofia: "nunca
recomenda, nunca altera produção sozinho, tudo com aprovação humana").

**Premissa que testei antes de construir:** toda a promessa do ERL
("82% das vezes", "score preditivo 91") só vale com profundidade
histórica real — e hoje o banco só tem 2024-2026 de fundamentos, dias
de preço/DFC/composição de capital. Rodar motores de padrão/
probabilidade sobre isso produziria números com CARA de rigor
estatístico sobre amostra pequena demais — a caixa preta que a própria
spec do Carlos proíbe.

**Investigado ao vivo antes de decidir o escopo:** CVM tem DFP/ITR de
**2010 a 2026, grátis**, no mesmo formato que o parser atual já lê (que
só usa 2024-2025 por escolha, não por limite da fonte) — expandir é
viável, mas precisa de validação antes de confiar (não repetir o erro
Bradesco/Sabesp). BCB SGS (CDI/IPCA) tem décadas de histórico público,
mesma situação. brapi (preços) e fontes pagas de Fluxo/Consenso ficam
em aberto — mesma decisão pendente do PIC 01 (item 15/17 da fila).

**Fase 1 construída e aplicada — só arquitetura, não o laboratório em
si:** migração 019, schema `erl` isolado do `public` (produção) —
cumprindo "nunca compartilhar banco com o Production Engine" por
isolamento de schema no MESMO projeto Supabase (não um projeto novo,
sem custo extra sem necessidade comprovada). 3 tabelas: `erl.hipoteses`
(Research Notebook, nunca DELETE), `erl.aprovacoes` (Research Approval
— nenhuma descoberta vira mudança de produção sem aprovação à mão,
construído ANTES de qualquer motor de descoberta existir, de
propósito), `erl.cobertura_dados` (8 fontes catalogadas com
profundidade real, verificado 8/8 linhas após aplicar).

**Deliberadamente fora desta fase:** expandir o backfill de verdade
(precisa validar o parser contra anos antigos primeiro), Time Machine,
Feature Store, e as camadas 4-14 inteiras (Pattern Discovery,
Predictive Power, Probability/Evidence Engine etc.) — todas dependem
de profundidade histórica que ainda não existe. Próximos passos
concretos documentados no doc, em ordem.

vitest 160/160 (sem mudança de código TS — só migração SQL + doc),
migração aplicada e verificada direto no Supabase (SQL Editor via
Chrome), commit `4aa8450`.

## NOVO (03/08 ~20h): CARRY — LEGENDA DOS 5 NÍVEIS + LEITURA AUTOMÁTICA GROWTH × CASH ✅ NO AR
Carlos viu WEGE3 (Growth +21,6% vs Cash +2,4% — diferença enorme) e
INTB3 (Growth +11,9% vs Cash +33%) e pediu uma legenda explicando cada
nível e "cenário". Construído: `LEGENDA_CARRY` em `/comparar` (texto
fixo, 5 níveis, rótulo de cenário — conservador/otimista/realista/
pendente/destino) + `src/lib/carry/leitura.ts` (novo, testado): compara
Growth × Cash por REGRA — growth bem acima do cash vira aviso explícito
("lucro alto no papel, ainda não virou caixa na mesma proporção"), cash
igual ou acima do growth vira confirmação. Verificado ao vivo: WEGE3
mostra o aviso âmbar, INTB3 mostra a confirmação verde, batendo com os
números do print do Carlos. 5 testes novos (160 no total), commit
`57fb87a`.

## NOVO (03/08 ~19h45): CARRY ENGINE — NÍVEIS 2 E 3 DESTRAVADOS (pergunta do Carlos: "que dado falta buscar?") ✅ NO AR
Carlos mandou print do `/comparar` (WEGE3) mostrando os 4 níveis do Carry
(Growth, Cash, Allocation, Retorno Intrínseco) todos em "aguarda dados" e
perguntou o que faltava buscar/integrar. **Resposta real: quase nada
precisava ser buscado — dois problemas diferentes, nenhum dos dois era
"falta um site pra integrar":**

1. **BUG, não dado faltando.** `/comparar` passava `dividendosJcpLtm` /
   `caixaOperacionalLtm` / `capexLtm` como `null` FIXO pro motor da escada
   — mesmo já buscando esses mesmos valores reais da tabela `fluxo_caixa`
   (DFC oficial da CVM, migração 011, coleta diária) seis linhas abaixo
   pro Compounder. O dado sempre esteve no banco; a escada do Carry nunca
   olhava pra ele. Corrigido: motor agora recebe os valores reais.
2. **Nível 3 (Carry Cash) nunca tinha sido implementado** — só existia o
   texto da pendência. Construído agora (`src/lib/carry/v3-cash.ts`):
   troca lucro contábil por caixa operacional líquido de capex (a mesma
   fórmula já documentada em `docs/carry-engine.md` desde antes), com o
   mesmo gate de honestidade dos outros níveis (nunca chuta sem os dois
   dados) e a mesma trava de linguagem.

**O que continua em "aguarda dados" e por quê (isso sim é dado, não bug):**
Nível 4 (Allocation — dividendos+recompras líquidos de diluição) e Nível 5
(Retorno Intrínseco) precisam de uma SÉRIE HISTÓRICA de composição de
capital pra medir diluição real. A coleta diária começou 02/08/2026 — hoje
existe ~1 dia de histórico. **Não existe site pra buscar isso**: diluição
só se mede comparando pontos no tempo, e o acervo cresce sozinho, um dia
por vez, com o robô que já roda todo dia. É questão de calendário, não de
integração.

7 testes novos (155 no total), tsc + vitest + build limpos, commit
`3e18c12`, deploy confirmado "Ready" na Vercel. **Verificação ao vivo
pendente:** o Chrome desconectou no meio da sessão (extensão caiu) — vou
confirmar visualmente assim que reconectar; o cálculo em si é testado
numericamente (fórmula exata batida em teste automatizado), não é uma
mudança visual arriscada.

## NOVO (03/08 ~19h): PIC 01 FASE 1 — ENCORPEI VIRA PLATAFORMA DE PATRIMÔNIO ✅ NO AR (decisão registrada em `roadmap/pic01-patrimonio-v1.md`)
Carlos mandou a especificação completa "PIC 01" (~20 módulos: Master
Decision Engine unificando 9 motores, Confluence Score, Portfolio Health,
Performance Attribution, Replay histórico completo, What Changed Engine,
Decision History, painel de IA, roadmap p/ Digital Twin/Monte Carlo/
multi-asset) e pediu pra eu decidir o melhor caminho ("faça o que achar
melhor... quero o melhor"). **Decisão registrada, foi minha:** dividir em
fases — o roadmap original do próprio Encorpei já tinha avisado que tentar
tudo de uma vez é escopo de equipe de 10+ pessoas por anos, e boa parte do
pedido pede de volta exatamente o que o Confluence Score (implantado
HORAS antes deste pedido) já tinha decidido deixar de fora por falta de
dado honesto (Fluxo institucional, Gestão).

**O que entrou nesta Fase 1, construído/testado/no ar:**
- **Home ("/") virou "Meu Patrimônio"**: mantém tudo que já existia
  (mudanças 48h, radar, ranking, diário, cenário macro) e ganha painel
  novo — patrimônio atual, rentabilidade desde a compra, Alpha vs. CDI e
  Ibovespa, drawdown, Sharpe.
- **Motor de Patrimônio** (`src/lib/patrimonio.ts`): série diária
  comparada com CDI/IPCA/Ibovespa por SIMULAÇÃO DE APORTE (mesmo capital,
  mesma data, no benchmark) — método honesto que não exige um ledger de
  transações completo. Só entram posições com data de compra registrada.
- **Decision Feed**: ação sugerida por posição (Aumentar/Reduzir
  prioridade, Aguardar melhor ponto, Nenhuma ação) — 100% por regras
  cruzando status da tese + Tese Técnica + timing, nunca IA, nunca
  "comprar/vender" (testado).
- **Saúde da Carteira** (`/saude-carteira`, nova página): concentração
  (índice HHI), diversificação por modelo, Carry/ROIC/valuation médios
  ponderados, sensibilidade média à Selic — com cobertura sempre visível.
- **Menu reorganizado**: "Patrimônio" é o 1º grupo (Meu Patrimônio →
  Carteira → Saúde da Carteira). Nenhuma rota removida.

**O que ficou de fora — decisão registrada, e o que precisa da sua
ratificação** (detalhe completo no doc):
- Master Engine com Fluxo/Gestão como notas 0-100 REAIS: não fabriquei —
  precisa de fonte de dado paga (Fluxo) ou proxy que ainda não existe
  (Gestão). Decisão de manter ausente continua valendo até você decidir
  diferente.
- Replay histórico completo e Performance Attribution: exigem infra nova
  (snapshot diário de Carry/Compounder/Technical/Confluence — hoje só o
  motor antigo tem `scores` diário — e ledger de transações completo, hoje
  só tem 1 data de compra por posição). Fase 2.
- Painel de IA em linguagem natural: já bloqueado por falta de
  `ANTHROPIC_API_KEY` (item antigo da fila).

Estado atual: Carlos ainda não registrou nenhuma posição com data de
compra em `/carteira` (verificado ao vivo — Carteira, Meu Patrimônio e
Saúde da Carteira mostram corretamente o estado "registre suas posições"),
então o painel novo ainda não tem o que mostrar — é a primeira coisa da
fila agora.

140 testes nesta etapa (120 + 20 novos: 9 de patrimônio, 6 de Decision
Feed, 5 de Saúde da Carteira; total sobe de novo com a Fase 1.5 abaixo),
build limpo, verificado ao vivo em produção. Commits `bd1e8ca` (motor) e
`ba65e7f` (aviso desatualizado na Carteira corrigido).

**PIC 01 Fase 1.5 (mesma tarde, após "vai seguindo"): Diário ganha
histórico de acertos/erros.** Item da spec — "guardar TODAS as decisões...
resultado posterior, acertou, errou" — sem precisar de infraestrutura nova
(reusa a tabela `decisoes`, imutável desde a migração 007, que já guarda a
foto do momento: score, status da tese, preço). Regra: julga se o PREÇO se
moveu a favor/contra desde a decisão — nunca se "a tese continua boa".
Mantive/observei nunca recebem julgamento direcional (sem direção
implícita). Antes de 30 dias, aparece marcado "cedo p/ julgar". Sem preço →
"indisponível", nunca inventa. **Decisão deliberada de não construir
agora:** a peça de infraestrutura de snapshot diário (que destravaria
Replay/Performance Attribution, item 16 da fila) colide com a sessão
autônoma já agendada pra hoje 20h58 BRT (`trig_015sisPqJfmZarM7VmKMue1b`,
que mexe no mesmo motor/rota) — esperando ela terminar antes de tocar
nisso. 8 testes novos (148 no total), verificado ao vivo: decisão "ABEV3 —
só observei" já registrada por você aparece corretamente como "Neutro"
(nunca direcional). Commit `eca1462`. Detalhe completo em
`roadmap/pic01-patrimonio-v1.md`.

## NOVO (03/08 ~19h30 e ~20h20): PIN REMOVIDO DO DIÁRIO E DA CARTEIRA (pedido do Carlos) ✅ NO AR
Carlos pediu pra tirar a chave/PIN exigida pra registrar decisão em
`/diario`. Antes de tirar, checei o risco: confirmado nas configurações do
projeto na Vercel (`get_project_deployment_protection`) que o domínio
inteiro já tem **Vercel Authentication (SSO)** ativo — bloqueia qualquer
acesso de quem não é membro do time `carlos-ferros-projects`. O PIN era
uma segunda trava redundante num app de usuário único; removê-lo não abre
o Diário pro público, porque quem não tem login na Vercel do Carlos nem
chega na página. `usuarioLogado()` mantido no código, sem função de gate
hoje (login próprio/Fase 4 ainda não ativado), só pra já registrar o autor
quando ativar. tsc + vitest (148/148) + build limpos, commit `523f133`,
verificado ao vivo — campo "Chave do sistema" sumiu do formulário.

Carlos depois viu o mesmo campo em `/carteira` (registrar posição) e
pediu o mesmo. Mesma decisão, mesmo raciocínio, sem repetir a checagem de
risco (já validada acima). Commit `2383650`, tsc + vitest (160/160) +
build limpos, verificado ao vivo — campo sumiu do formulário de posições
também.

## NOVO (03/08 ~18h): AUDITORIA DE DADOS — dívida/ROIC de bancos + valor de mercado do Sabesp ✅ CORRIGIDO E NO AR
Carlos reportou dois problemas concretos, com print do Radar: "Bradesco não tem dívida, aí mostra com muita dívida" e "Sabesp não tem os números batendo com a realidade". Investigação confirmou os dois, e achou que o mesmo padrão de bug se repetia em 4 lugares do sistema — incluindo o motor OFICIAL que grava nota imutável.

**Causa raiz #1 — "é financeira?" calculado por DADO, não por MODELO.** `radar.ts`, `compounder-dados.ts` e `comparar/page.tsx` decidiam se um ticker era banco/seguradora olhando se os campos `roic`/`divida_liquida` vinham NULL no banco. Isso é dado, não modelo: BBDC4, BBAS3, BBSE3 e CXSE3 têm filings da CVM que populam esses campos por acidente (contas contábeis genéricas do parser, sem exclusão específica pra banco), então apareciam com "dívida" e "ROIC" industriais sem sentido nenhum — exatamente o que o Carlos viu no Bradesco. ITUB4 e PSSA3 só pareciam "corretos" (mostrando "—") por sorte de quais campos aquele filing específico populou.
**Correção:** nova função `ehModeloFinanceiro()` em `setores.ts`, derivada do Sector Intelligence já existente (`indicadorPermitido` / `INDICADORES_EXCLUIDOS`) — nunca varia com o acaso do dado bruto. `roic4`/`alav`/`caixaLiquido` agora são gateados por `indicadorPermitido` nos 3 lugares de exibição.

**Causa raiz #2 — valor de mercado sempre preferia `acoes_totais × fechamento`, sem checar divergência.** `acoes_totais` só é atualizado quando a CVM republica a "composição do capital" — então um desdobramento recente fica com contagem de ações desatualizada até a CVM refilar (pode levar meses). Confirmado: SBSP3 (Sabesp) teve desdobramento ~5:1 não refletido — nosso valor de mercado calculado saía ~80% menor que o real. Outros 3 tickers com divergência relevante (>15%): MULT3 (42%), AXIA3 (22%), EGIE3 (19%).
**Correção:** nova `src/lib/marketcap.ts` (`marketCapSelecionado`) reusa a banda "bloqueio" (10%) já existente em `auditoria.ts` — quando a divergência entre o calculado (CVM) e o valor ao vivo (brapi, que o próprio sistema já coleta todo dia) passa de 10%, o sistema passa a confiar no dado ao vivo, com o motivo registrado. **Decisão deliberada: NÃO editei `acoes_totais` com números buscados no StatusInvest/web** — isso violaria a regra de fundação "nunca estimar/inventar dado" (confiar em fonte externa não-integrada). A correção é o próprio sistema parar de ignorar um dado que ele já coleta.

**Onde foi corrigido (4 lugares, mesmo padrão):** `src/lib/radar.ts`, `src/lib/compounder-dados.ts`, `src/app/comparar/page.tsx` — e, mais importante, **`src/app/api/teses/avaliar/route.ts`**, o cron noturno que grava o **score OFICIAL imutável** na tabela `scores` (INSERT-only). Esse era o achado mais grave: o preview do Radar é só uma prévia, mas o score gravado pelo cron é o dado "de verdade" do sistema. A partir de hoje ele também usa o gate por modelo e a mesma checagem de divergência de valor de mercado. Scores já gravados em dias anteriores NÃO foram (e não podem ser, regra de fundação — tabela imutável) reescritos — a correção vale a partir de agora.

**Ponto em aberto que isso NÃO resolve:** `/api/teses/avaliar` continua usando o motor de nota genérico (`calcularScore`, `score.ts`), não o motor setorial completo (`calcularScorePorModelo`, `score-setorial.ts`) que Radar/Compounder/Técnico já usam — essa troca maior está na "fiação do motor" já agendada (trigger `trig_015sisPqJfmZarM7VmKMue1b`, hoje 20h58 BRT). O patch de hoje é um remendo cirúrgico pra parar de gravar dado sem sentido AGORA, não substitui essa migração maior — as duas coisas são complementares, não conflitam.

**12 testes novos** (`setores.test.ts` + `marketcap.test.ts`, casos-âncora com BBDC4/BBAS3/BBSE3/CXSE3 e o caso SBSP3). `npx tsc --noEmit`, `npx vitest run` (120/120) e `npm run build` limpos antes do push. Verificado AO VIVO depois do deploy: `/radar` (BBDC4/BBAS3/ITUB4/BBSE3/CXSE3 mostram "—" onde antes mostravam número; SBSP3 com P/L 11,2× em vez do valor distorcido), `/comparar?a=BBDC4&b=ITUB4&c=SBSP3` (mesma checagem, mais o texto do Carry "Banco/seguradora — ROIC e dívida não se aplicam ao modelo" aparecendo corretamente) e `/compounders` (BBDC4 com 5/8 componentes, igual ITUB4 — antes tinha um componente a mais vindo de ROIC contaminado).

## NOVO (03/08 ~17h20): TECHNICAL INTELLIGENCE ENGINE v1 NO AR ✅
Carlos mandou a especificação completa (20+ seções) e pediu para eu decidir o melhor caminho antes de implementar — decisão registrada por escrito em `roadmap/technical-engine-v1.md`, aqui o resumo.

**Filosofia (do próprio Carlos, cravada no código):** o Encorpei não é análise técnica nem fundamentalista isoladas — é DECISÃO. Fundamentos decidem O QUE. O gráfico decide QUANDO. O gráfico nunca aprova uma empresa ruim. A IA NUNCA diz "compre"/"venda" — só "Momento Favorável", "Momento Desfavorável" ou "Aguardar melhor ponto" (testado: a frase nunca contém essas palavras).

**Pré-requisito que resolvi primeiro:** `precos_diarios` nunca guardava máxima/mínima reais, embora a brapi sempre tenha devolvido isso no payload. Migração 018 (aditiva, sem quebrar nada) + backfill lendo o próprio `dados_brutos` já salvo (nenhum dado inventado) — confirmado 2520/2520 linhas, 40/40 tickers. Sem isso não dava pra calcular ATR/Bollinger de verdade nem estrutura de mercado.

**O que está no ar:** `/tecnico` (nova aba, entre Compounders e Teses) com ranking completo, e `/tecnico/[ticker]` com o detalhe de 5 componentes — Tendência 30% (MM9/21/72), Momentum 25% (RSI+MACD+ROC), Volume 15% (relativo+OBV), Estrutura 15% (topos/fundos), Rompimentos 15% (suporte/resistência + confirmação por volume). Componente sem dado fica NULO, peso redistribuído — mesma disciplina do Carry/Compounder. ATR e Bollinger aparecem como informativos, ainda fora da nota. Também no ar: **Confluence Engine** (`src/lib/confluencia.ts`) combinando Fundamentos(30%)+Carry(20%)+Compounder(25%)+Technical(25%) numa nota 0-100 + rótulo de Convicção — Macro/Fluxo/Gestão ficam de fora, documentados como ausência real, não peso escondido.

**Por que não implementei a spec inteira (decidido ANTES de construir):**
- Sem candle semanal/mensal coletado → a hierarquia Semanal 60%/Mensal 30%/Diário 10% pedida na spec é impossível hoje. V1 usa só diário, documentado. Fica para v2.
- Padrões gráficos nomeados (triângulos, OCO, bandeiras) exigem curadoria visual — a própria spec disse "nunca decidir sozinho". Fora desta v1.
- Sem profundidade histórica de preço/fundamentos suficiente → backtest e simulador ficam de fora (mesma razão do Compounder).
- Sem snapshot diário de score gravado → timeline de entrada/saída fica de fora.
- `MarketDataProvider` (interface + `BrapiProvider` de referência) foi criada em `src/lib/mercado/provider.ts`, mas **não conectada** ao `route.ts` de coleta em produção — não quis arriscar o cron noturno sem uma segunda fonte real pra justificar a troca agora. Quando existir, é trocar uma linha.
- "Encorpei Market Digital Twin": Carlos pediu explicitamente para não implementar ainda. Não toquei.

**2 bugs achados e corrigidos ao verificar em produção (nunca confiar só no "Ready" da Vercel):**
1. PostgREST corta silenciosamente em ~1000 linhas mesmo pedindo `.limit(20000)` — cada ticker só recebia ~25 dos 63 pregões reais. Corrigido com paginação real (`.range()`).
2. A página de detalhe não rolava — Volatilidade e Confluência ficavam inacessíveis abaixo da dobra. Corrigido.
Ambos confirmados ao vivo depois do fix: WEGE3 mostra 63 pregões, Score Técnico 63 (Bom/Momento Favorável), Confluência 65 (Convicção moderada).

## COMPOUNDER ENGINE v1 NO AR ✅ (registrado na rodada anterior, sem mudanças hoje)
Categoria própria (nunca misturada com Value/Dividendos/Carry). Score 0-100, 8 componentes com peso documentado. Detalhe completo em `roadmap/compounder-engine-v1.md`. `/compounders` e `/compounders/[ticker]` no ar.

## 11 TESES RATIFICADAS ✅
Carlos aprovou no chat, sem ajustes ao dossiê de 02/08. Migração 017 aplicada e verificada — 11/11. Faltam ratificar os 13 modelos setoriais (item separado).

## FDIE FASE 1 NO AR ✅ — achou 2 problemas reais no primeiro dia, e hoje pegou os 2 que o Carlos reportou também
Detalhe completo em `roadmap/fdie-fase1.md`. Achados pendentes: margem SUZB3 (39,3% líquida > 28,8% bruta, matematicamente impossível — parser CVM). O achado de ROIC/Dív·Patr de financeiras no Radar — que já estava sinalizado como "crítico" pelo próprio FDIE (`checarIndicadorSetorial`) — foi corrigido hoje (ver seção da auditoria acima); o gap era que o FDIE detectava mas nada consumia o achado para se autocorrigir. Isso mudou.

## PONTO EM ABERTO — não resolvido, só constatado
O `/api/teses/avaliar` oficial ainda usa o motor de nota GENÉRICO (`calcularScore`, `score.ts`) — não o motor setorial completo (`calcularScorePorModelo`, `score-setorial.ts`) que Radar/Compounder/Técnico já usam. Hoje ele ganhou os MESMOS gates de Sector Intelligence e de divergência de valor de mercado que os outros 3 lugares (ver auditoria acima) — mas continua sendo o motor genérico por baixo, não o setorial completo. A troca completa fica para a fiação do motor (20h58 BRT hoje).

## MIGRAÇÕES 009-018 — TODAS APLICADAS ✅
Aplicadas via SQL Editor (conta ENCORPEITECH/EncorpeiInvest) e VERIFICADAS com contagem direta.

## MÓDULO CARTEIRA ✅ NO AR · BENCHMARKS REAIS (CDI/IPCA/Ibovespa) ✅
Sem mudanças hoje.
- CONECTOR SUPABASE MCP: ainda aponta pra org errada (VIAGENS, não ENCORPEITECH) — contorno padrão é Chrome/SQL Editor.

## FIAÇÃO DO MOTOR — AGENDADA (trig_015sisPqJfmZarM7VmKMue1b, hoje 20h58 BRT)
Às 20h58: verificar estreia + sync → ligar motor v2 oficial, carry_score diário, montagem 12m da DFC. O patch de hoje na auditoria de dados (ver acima) NÃO substitui essa fiação — reduz o dano enquanto ela não chega.

## HOJE À NOITE (automático)
20h coleta+sync (idempotente) · 20h30-35 motor · 20h58 bloco de fiação · 21h34 supervisão avisa o Carlos.

## FILA DO CARLOS
1. ~~Ratificar 11 teses~~ ✅ · 2. Ratificar os 13 modelos setoriais · 3. ~~Decidir sobre a coluna ROIC/Dív·Patr de financeiras no Radar~~ ✅ corrigido hoje (era bug, não decisão de produto) · 4. Investigar a margem SUZB3 (parser) · 5. Decidir texto da "carteira Compounder" (regra 7/CI) · 6. **Registrar posições REAIS em /carteira COM data de compra** — sem isso, o novo painel Meu Patrimônio (Alpha/drawdown/Sharpe) fica sem o que mostrar; é o item que mais destrava agora · 7. Registrar decisões (2/3) · 8. Resend keys · 9. Reconectar Supabase MCP NA ORG ENCORPEITECH · 10. Auth · 11. (opcional) ANTHROPIC_API_KEY · 12. (opcional) API paga para FDIE multi-fonte · 13. quando existir fonte de dado profissional, avisar pra eu ligar o `MarketDataProvider` de verdade · 14. considerar se vale a pena checar periodicamente (trimestral?) se `acoes_totais` está divergindo de outros tickers além dos 4 achados em 03/08 (SBSP3, MULT3, AXIA3, EGIE3) · 15. (novo, PIC 01) decidir sobre Fluxo institucional (contratar fonte paga?) e sobre o texto/limite da "carteira Compounder" com pesos sugeridos — ambos batem na regra 7/CI · 16. (novo, PIC 01) quando quiser Replay histórico completo e Performance Attribution de verdade, avisar — precisa de uma peça de infraestrutura nova (snapshot diário dos motores + ledger de transações) antes de virar tela · 17. (novo, PIC 01, ainda sem resposta) Decision History já está no ar em /diario — mas hoje só existe 1 decisão registrada (ABEV3), então o histórico de acertos/erros ainda não tem volume pra dizer nada útil; quanto mais você registrar em /diario, mais essa peça vale · 18. (novo, ERL) checar no dashboard da sua conta brapi qual a profundidade de histórico de preço o plano atual permite (dias? anos?) — sem isso não dá pra saber se o Historical Database do Research Lab consegue ter candles de verdade ou só a partir de agora · 19. (novo, ERL — mesma decisão do item 15) Fluxo institucional e consenso de analistas também bloqueiam 2 dos fatores do Research Lab (camada 6), não só o Master Engine do PIC 01 — é a mesma fonte paga que resolveria os dois de uma vez.

## PRÓXIMOS
Fase C: coletor IF.data/Bacen · SUSEP · perfis de sensibilidade macro · Sharpe/alpha da carteira. Carry Allocation (v4)/Retorno Intrínseco (v5) — aguardam a série de composição de capital acumular (começou 02/08/2026). FDIE Fase 2, Compounder Fase 2 e Technical Fase 2 (hierarquia semanal/mensal, padrões gráficos, backtest) — todos gated em decisões do Carlos ou mais profundidade de dado coletado.

## RODA SOZINHO
06h CVM+DFC · 07h IPE · 08h benchmarks · seg 09h Focus · 20h coleta+sync · 20h30 motor · 21h34 supervisão · CI · custo ~R$ 0/mês
## Migrações: TODAS aplicadas (009-018). Vercel ✅ · Supabase MCP ainda org errada (usar Chrome/SQL Editor) · push ok (token exp ~31/08).
