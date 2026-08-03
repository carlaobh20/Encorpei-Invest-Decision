# PIC 01 — Encorpei v2.0, Fase 1 (Patrimônio) — decisão de escopo, e o que ficou de fora

**O que é:** Carlos mandou a especificação completa "PIC 01" — transformar o
Encorpei de sistema de análise de ações em plataforma institucional de
gestão de patrimônio, com ~20 módulos novos (Master Decision Engine,
Confluence Score unificando 9 motores, Portfolio Health, Performance
Attribution, Replay histórico completo, What Changed Engine, Decision
History, painel de IA em linguagem natural, roadmap para Digital Twin/
Monte Carlo/multi-asset, etc.), e pediu para eu decidir a melhor forma de
executar ("faça o que tem de melhor... quero o melhor para enxergar e
fazer o melhor").

## Decisão de escopo (registrada — foi minha, não do Carlos)

Antes de escrever qualquer código, confrontei a spec com o que o roadmap
já registrado do próprio Encorpei (`encorpei-invest-roadmap-v1.md`, v1.1,
31/07/2026) já tinha avisado: *"o que não sobrevive ao teste é o plano
implícito de construir os 10 motores, Replay Total, Time Machine... como
um único projeto — isso é escopo de uma equipe de 10+ pessoas por 2-3
anos"*. O PIC 01, na prática, pede exatamente esse "tudo de uma vez" —
inclusive coisas que o próprio Confluence Score de hoje (implantado
horas antes deste pedido) decidiu deliberadamente deixar de fora por
falta de dado honesto (Fluxo institucional, Gestão).

**Minha decisão: dividir o PIC 01 em fases, e construir agora só o que dá
pra fazer com dado 100% real que o sistema já tem.** Não travei o
trabalho esperando aprovação — segui o "não pare a esteira" que você
mesmo pede — mas registro aqui o que fiz e o que fica pendente de decisão
sua.

### O que entrou nesta Fase 1 (construído, testado, no ar)

1. **Home ("/") virou "Meu Patrimônio"** — mantém 100% do que já existia
   (mudanças 48h, radar, ranking oficial, diário, carteira, cenário
   macro) e ganha um painel novo em cima: patrimônio atual, resultado
   sobre o preço médio, rentabilidade desde a compra, Alpha vs. CDI e vs.
   Ibovespa, drawdown máximo, Sharpe — tudo calculado, nada estimado.
2. **Motor de Patrimônio** (`src/lib/patrimonio.ts` + `patrimonio-dados.ts`,
   9 testes): série diária de valor da carteira comparada com CDI/IPCA/
   Ibovespa por **simulação de aporte** — "se o dinheiro investido em cada
   posição, na mesma data, tivesse ido pro benchmark, quanto valeria
   hoje?" — método padrão, auditável, sem precisar de um ledger de
   transações completo (que não temos).
3. **Decision Feed** (`src/lib/decision-feed.ts`, 6 testes): ação sugerida
   por posição — "Aumentar prioridade" / "Reduzir prioridade" / "Aguardar
   melhor ponto" / "Nenhuma ação necessária" — 100% por regras cruzando
   status da tese + Tese Técnica (motor Technical) + timing. Testado que
   NUNCA aparece "comprar"/"vender" (regra 7 do CLAUDE.md).
4. **Portfolio Health** (`/saude-carteira`, novo, `src/lib/portfolio-health.ts`,
   5 testes): concentração (índice HHI), diversificação por modelo de
   negócio, Carry médio ponderado, ROIC médio ponderado (bancos/
   seguradoras corretamente fora, por causa do Sector Intelligence),
   valuation médio ponderado, sensibilidade média à Selic — com cobertura
   (quantas posições entraram em cada média) sempre visível.
5. **Menu reorganizado** (`Shell.tsx`): "Patrimônio" vira o primeiro grupo
   (Meu Patrimônio → Carteira → Saúde da Carteira), Radar ganha o rótulo
   "Oportunidades" ao lado do nome. **Nenhuma rota foi removida.**

### O que ficou de fora — decisão registrada, motivo, e o que eu preciso que você rate

- **Master Decision Engine unificando Fluxo e Gestão como notas 0-100
  reais.** O Confluence Score (implantado hoje, antes deste pedido) já
  documentou por que Fluxo (sem fonte de dado institucional/estrangeiro
  coletada) e Gestão (sem proxy honesto) ficam de fora da soma. O PIC 01
  pede eles DE VOLTA como componentes reais do "Master Engine". **Não
  fabriquei esses números** — inventar um score de Fluxo sem dado
  violaria a regra de fundação #6 (regras decidem com dado real, nunca
  decoração). **Preciso que você decida:** contratar uma fonte de dado de
  fluxo institucional/estrangeiro (tem custo), ou manter a decisão atual
  documentada como ausência honesta.
- **Replay histórico completo** (qualquer data, Carry/Confluence/notas/
  pesos de então): hoje só a tabela `scores` (motor antigo) tem snapshot
  diário. Carry, Compounder, Technical e Confluence são calculados NA
  HORA, sem gravação diária — não existe "01/01/2025" pra esses motores
  ainda. Isso é uma peça de infraestrutura nova (tabela de snapshot +
  cron gravando todo dia), não um ajuste de tela. Fica pra Fase 2.
- **Performance Attribution** (seleção vs. timing vs. macro vs. setorial):
  exige um ledger de transações completo (todo aporte, toda venda
  parcial, com data). Hoje `posicoes` guarda só o estado atual + 1 data de
  compra por ticker — não dá pra separar essas fontes de retorno com
  honestidade ainda. Fica pra Fase 2, junto com o Replay (a mesma peça de
  infraestrutura destrava as duas).
- **Painel de IA em linguagem natural** ("o que devo fazer hoje?" em
  português corrido): já documentado como bloqueado por falta de
  `ANTHROPIC_API_KEY` — item que já está na sua fila desde antes deste
  pedido.
- **Roadmap para Digital Twin / Scenario Engine / Monte Carlo / multi-asset
  / cripto / REITs / renda fixa**: são só documentação de intenção, não
  código — não constroem nada sozinhos, então não competem com trabalho
  real. Ficam registrados aqui como Fase 3+ do PIC 01, sem arquitetura
  nova hoje.

## A "mais uma mudança" do Carlos — a que ele considera a mais importante

A pergunta "qual decisão aumenta mais a probabilidade de enriquecer nos
próximos 10 anos" (em vez de "qual ação comprar") é exatamente o que o
Portfolio Health e o Decision Feed desta Fase 1 começam a responder: o
Decision Feed já avalia cada posição no contexto da carteira que existe
(nunca isolada), e a Saúde da Carteira mostra concentração/diversificação
ANTES de qualquer recomendação por empresa. A versão completa dessa ideia
— simular o EFEITO de uma decisão sobre a carteira inteira antes de
sugeri-la (ex.: "aumentar WEGE3 pioraria sua concentração em industrial") —
é um motor novo (`Portfolio Impact Simulator`), candidato natural pra
Fase 2, depois que Portfolio Health estiver validado no uso real.

## Versionamento

Patrimônio v1 (`src/lib/patrimonio.ts`), Decision Feed v1
(`src/lib/decision-feed.ts`), Portfolio Health v1
(`src/lib/portfolio-health.ts`) — mesma regra do resto do sistema: mudar
fórmula ou peso é nova versão, nunca editar a v1 por baixo.

## Fase 1.5 — Decision History (03/08/2026)

Depois do "vai seguindo", o próximo passo natural seria a infraestrutura de
snapshot diário (Carry/Confluence gravados dia a dia — o que destrava
Replay e Performance Attribution, listados acima como Fase 2). **Não
construí isso agora**: descobri, checando as tarefas automáticas já
agendadas, que uma sessão autônoma dispara hoje às 20:58 (horário de
Brasília) e vai mexer exatamente nesse mecanismo (`/api/teses/avaliar`,
trocar pro `calcularScorePorModelo`, gravar `carry_score` diário). Construir
a mesma coisa em paralelo colidiria com esse trabalho já agendado — decidi
esperar essa sessão terminar antes de tocar nesse motor.

Em vez disso, construí uma peça do PIC 01 que não depende disso: **"Guardar
TODAS as decisões... Resultado posterior. Acertou. Errou."**
(`src/lib/decision-history.ts`, 8 testes). O Diário já guardava tudo que a
spec pedia — data, empresa, motivo, e a foto do que o sistema dizia no
momento (score, status da tese, preço) — de forma imutável desde a
migração 007. Faltava só julgar o resultado depois. A regra:

- Julga se o **PREÇO** se moveu a favor ou contra a decisão — nunca se "a
  tese continua boa" (comprar uma ótima empresa pode errar 3 meses e
  acertar 3 anos; isso fica explícito no texto de cada julgamento).
- "Mantive"/"observei" **nunca** recebem julgamento direcional (essas duas
  não têm direção implícita) — sempre neutro, mesmo com preço disparando.
- Sem preço na decisão ou sem preço atual → "indisponível", nunca inventa.
- Antes de 30 dias, o julgamento aparece marcado "cedo p/ julgar" (ruído de
  curto prazo pesa mais que sinal nesse intervalo).

Já no ar em `/diario`. Verificado ao vivo: a decisão "ABEV3 — só observei"
do Carlos aparece corretamente como "Neutro" (não direcional), com o aviso
de que ainda é cedo.
