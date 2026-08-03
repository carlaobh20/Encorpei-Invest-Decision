# Encorpei Invest — Status de execução

Atualizado em 03/08/2026 ~19h20 (PIC 01 Fase 1: Home vira Meu Patrimônio, com série real vs CDI/IPCA/Ibovespa, Decision Feed e Saúde da Carteira — no ar · PIC 01 Fase 1.5: Diário ganha histórico de acertos/erros — no ar · Auditoria de dados corrigida e no ar · 11 teses ratificadas · FDIE Fase 1 no ar · Compounder Engine v1 no ar · Technical Intelligence Engine v1 no ar).

## ESTADO DAS FASES
- Fase 0 ✅ · 1 ✅ · 2.5 ✅ · 3 ✅ · Fase 7 adiantada
- Fase 2: 11 teses RATIFICADAS ✅ · Fase 4 ✅ · Fase 5 em curso (1ª decisão ABEV3)
- Segurança ✅ · Qualidade ✅ (148 testes + CI)

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

## NOVO (03/08 ~19h30): DIÁRIO — PIN REMOVIDO (pedido do Carlos) ✅ NO AR
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
1. ~~Ratificar 11 teses~~ ✅ · 2. Ratificar os 13 modelos setoriais · 3. ~~Decidir sobre a coluna ROIC/Dív·Patr de financeiras no Radar~~ ✅ corrigido hoje (era bug, não decisão de produto) · 4. Investigar a margem SUZB3 (parser) · 5. Decidir texto da "carteira Compounder" (regra 7/CI) · 6. **Registrar posições REAIS em /carteira COM data de compra** — sem isso, o novo painel Meu Patrimônio (Alpha/drawdown/Sharpe) fica sem o que mostrar; é o item que mais destrava agora · 7. Registrar decisões (2/3) · 8. Resend keys · 9. Reconectar Supabase MCP NA ORG ENCORPEITECH · 10. Auth · 11. (opcional) ANTHROPIC_API_KEY · 12. (opcional) API paga para FDIE multi-fonte · 13. quando existir fonte de dado profissional, avisar pra eu ligar o `MarketDataProvider` de verdade · 14. considerar se vale a pena checar periodicamente (trimestral?) se `acoes_totais` está divergindo de outros tickers além dos 4 achados em 03/08 (SBSP3, MULT3, AXIA3, EGIE3) · 15. (novo, PIC 01) decidir sobre Fluxo institucional (contratar fonte paga?) e sobre o texto/limite da "carteira Compounder" com pesos sugeridos — ambos batem na regra 7/CI · 16. (novo, PIC 01) quando quiser Replay histórico completo e Performance Attribution de verdade, avisar — precisa de uma peça de infraestrutura nova (snapshot diário dos motores + ledger de transações) antes de virar tela · 17. (novo, PIC 01, ainda sem resposta) Decision History já está no ar em /diario — mas hoje só existe 1 decisão registrada (ABEV3), então o histórico de acertos/erros ainda não tem volume pra dizer nada útil; quanto mais você registrar em /diario, mais essa peça vale.

## PRÓXIMOS
Fase C: coletor IF.data/Bacen · SUSEP · perfis de sensibilidade macro · Carry Cash v3 · Sharpe/alpha da carteira. FDIE Fase 2, Compounder Fase 2 e Technical Fase 2 (hierarquia semanal/mensal, padrões gráficos, backtest) — todos gated em decisões do Carlos ou mais profundidade de dado coletado.

## RODA SOZINHO
06h CVM+DFC · 07h IPE · 08h benchmarks · seg 09h Focus · 20h coleta+sync · 20h30 motor · 21h34 supervisão · CI · custo ~R$ 0/mês
## Migrações: TODAS aplicadas (009-018). Vercel ✅ · Supabase MCP ainda org errada (usar Chrome/SQL Editor) · push ok (token exp ~31/08).
