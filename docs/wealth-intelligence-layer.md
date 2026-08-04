# Wealth Intelligence Layer — Bloco 2, Sprint 2.9 (Fase A1)

## O que é

Continuação do Wealth Operating System (Sprint 2.8): 4 dos 5 módulos
pedidos, todos compostos sobre motores já existentes — nenhum motor novo,
nenhuma alteração em Foundation/Decision Object/Truth Layer/Memory Layer.

## Achado mais importante desta sprint (não é sobre código, é sobre processo)

Ao começar o Módulo 3 (Capital Allocation), escrevi do zero uma fórmula de
"score de alocação" combinando Portfolio Fit/Carry/Confluence/Quality/Risk
— antes de checar se algo assim já existia. O editor bloqueou a escrita
porque `src/lib/capital-allocation.ts` **já existia**: um motor congelado
("Foundation v4, Módulo 6", `calcularAlocacaoCapital`) que distribui
capital proporcionalmente ao Confluence Score entre candidatos elegíveis,
com piso de convicção e teto de concentração — construído em algum sprint
anterior a este, documentado, testado, e **nunca conectado a nenhuma
tela** (confirmado por busca: zero usos fora do próprio arquivo).

Se o editor não tivesse bloqueado, eu teria criado um SEGUNDO motor de
alocação fazendo algo parecido mas com pesos diferentes — exatamente o
tipo de "lógica duplicada" que a spec desta sprint (e a de 2.8) proíbe
explicitamente. Registrando aqui porque é o tipo de erro que só um
inventário feito ANTES de escrever código evita — e porque é evidência a
mais de que vale a pena, no início de toda sprint grande, perguntar
"o que já existe?" antes de "o que eu construo?". Módulo 3 foi refeito do
zero como uma camada fina que só alimenta o motor congelado com a carteira
atual (`capital-allocation-simulacao.ts`).

## Módulos entregues (Fase A1)

1. **Portfolio Optimizer** (`portfolio-optimizer.ts`) — "Nota atual" vs
   "Nota ideal" chamando `montarWealthHealth` (Sprint 2.8) DUAS vezes: uma
   com os dados reais, outra com Diversificação/Liquidez no melhor
   patamar possível (os 2 únicos componentes do Wealth Health que dependem
   de COMO o capital é distribuído entre ativos já possuídos, não de QUAIS
   ativos são possuídos). Gargalos vêm ordenados por gap, marcados como
   "rebalanceável" (concentração/liquidez) ou "depende dos ativos" (o
   resto) — nunca sugere qual empresa comprar.
2. **Capital Allocation** (`capital-allocation-simulacao.ts`) — wrapper
   sobre o motor congelado `calcularAlocacaoCapital` (ver achado acima),
   alimentado com a carteira atual como lista de candidatos. Mostra peso
   atual/sugerido/faixa saudável (0% – 15%, teto já definido no motor
   congelado)/impacto por posição. SEMPRE rotulado como simulação — nunca
   uma ordem (rule 7 do CLAUDE.md, texto do aviso testado explicitamente).
3. **Performance Attribution — extensão** (`portfolio-attribution.ts`) —
   os 2 fatores novos que a spec pediu (Expansão de Múltiplo, Dividendos)
   não têm fonte de dado real hoje (sem série histórica de P/L persistida;
   sistema nunca rastreou proventos recebidos) — aparecem como "Em
   desenvolvimento" com o motivo, exatamente como a própria spec instrui
   pra quando um fator não pode ser calculado. Retorno/Carry/Diversificação
   continuam como no Sprint 2.8.
4. **Wealth Goal Simulator** (`simularMeta`, extensão de `wealth-engine.ts`
   + `SimuladorMeta.tsx`) — Carlos digita meta/prazo/aporte mensal/inflação
   esperada e vê projeção determinística (patrimônio projetado, gap, CAGR
   real necessário) na hora, 100% client-side, sem tocar o banco.
   "Probabilidade" continua SEMPRE indisponível — construir um motor
   estocástico agora violaria a própria regra desta sprint ("não criar
   motores novos"); a spec também pede "nunca estimativas sem identificar
   quando forem projeções", e é exatamente isso que a projeção
   determinística rotulada faz.

## O que NÃO foi entregue nesta rodada

- **Módulo 5, Decision History, inteiro.** Não existe hoje NENHUM lugar no
  sistema que registre "decisão tomada + resultado observado + lição" —
  isso é uma tabela nova (a 3ª empilhada atrás do bloqueio Supabase, depois
  de 022/023), uma tela/formulário novo pra registrar a decisão, e
  integração em 2 telas que já existem (Replay, Research Lab). É, sozinho,
  do tamanho de uma sprint inteira — não um quinto módulo de cinco. Fica
  pra uma sprint dedicada, registrada no roadmap.
- **Cadastro PERSISTENTE de meta patrimonial** (Módulo 1 completo). O
  Simulador entrega a simulação; salvar a meta entre sessões continua
  exigindo a mesma migração nova (024) represada atrás do bloqueio
  Supabase — mesma decisão de escopo já registrada no Sprint 2.8, ainda
  sem resposta do Carlos.
- **Integração de Portfolio Optimizer/Capital Allocation em Empresas e
  Decision Center** (ENTREGA pedia as 3 telas). Os dois módulos são,
  por natureza, de CARTEIRA (não fazem sentido por empresa isolada) — Meu
  Dash é a casa certa. Replicar as mesmas tabelas em Decision Center seria
  duplicar VISUALIZAÇÃO de dado já mostrado em Meu Dash sem agregar nada
  novo — decidi não fazer isso sem antes confirmar com o Carlos se ele
  quer esse tipo de repetição ou prefere um link cruzado.

## Autoavaliação crítica (ENTREGA item 10)

**Onde este pacote é mais frágil, sem me defender:**

1. **"Nota ideal" do Portfolio Optimizer é uma simplificação forte.** Só
   isola concentração/liquidez como "rebalanceáveis" — na prática, um
   gestor também rebalanceia pra CIMA de posições com Confluence/Quality
   melhores dentro do que já possui, não só pra reduzir concentração. Não
   modelei isso porque exigiria decidir "o que é uma alocação melhor entre
   ativos que já tenho" — que é literalmente o que o Capital Allocation
   (Módulo 3) já responde separadamente. Os dois módulos deveriam, no
   fundo, estar mais integrados um ao outro do que estão hoje.
2. **Capital Allocation reaproveita um motor pensado pra capital NOVO,
   não pra rebalancear o que já existe.** `calcularAlocacaoCapital` foi
   documentado, no comentário original, como resposta a "dado ESTE piso e
   ESTE teto, como dividir capital entre candidatos" — não fala nada sobre
   custo de transação, imposto sobre ganho de capital ao vender uma
   posição pra rebalancear, ou o fato de que sair de uma posição existente
   é uma decisão diferente de nunca ter entrado nela. A simulação mostra
   "onde a carteira ficaria" sem nenhum desses custos — o texto do aviso
   deixa isso implícito, não explícito.
3. **Simulador de Meta some ao recarregar a página.** Correto dado o
   bloqueio de banco, mas é uma experiência inferior ao que a spec pediu
   ("cadastrar"). Se o Carlos simular uma meta hoje e voltar amanhã, digita
   tudo de novo.
4. **Nenhum dos 4 módulos foi testado contra um FDIE ou fluxo de decisão
   real do Carlos** — só contra dados sintéticos nos testes automatizados.
   A verificação em produção continua pendente (mesmo item da fila desde
   sprints anteriores).

## Testes

81 arquivos, 642 testes na suíte inteira (era 620 no Sprint 2.8) — 22
testes novos: 5 (Portfolio Optimizer) + 6 (Capital Allocation) + 1
(Attribution, fatores indisponíveis) + 10 (Simulador de Meta). `npx tsc
--noEmit` limpo. `npm run build` limpo. ESLint limpo (só o débito
pré-existente de `Date.now()` em `page.tsx`, confirmado via `git diff` como
não tocado por esta sprint — mesmo item já registrado desde o Sprint 2.3).

## Pendências (ordem sugerida)

1. Decidir sobre a migração de Meta Patrimonial (024) — agora com um
   motivo a mais: sem ela, o Simulador de Meta nunca vira "cadastro" de
   verdade. Mesma pergunta feita no Sprint 2.8, ainda sem resposta.
2. Sprint dedicada ao Decision History (Módulo 5) — tabela nova + tela de
   registro + integração Replay/Research Lab.
3. Decidir se Portfolio Optimizer e Capital Allocation devem aparecer
   também em Decision Center (link cruzado vs. duplicar a tabela).
4. Resolver o bloqueio de conector Supabase — sem isso, migrações 022, 023
   e a futura 024 continuam empilhando.
