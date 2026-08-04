# Wealth Operating System — Bloco 2, Sprint 2.8 (Fase A1)

## O que é

Reorganização do Meu Dash em torno de "como isso impacta meu patrimônio"
em vez de "como está esta empresa" — nenhum motor novo, nenhuma alteração
em Foundation/Truth Layer/Memory Layer/Decision Object/Carry/Confluence/
Probability. Tudo aqui é composição sobre o que já existe.

## Por que "Fase A1" outra vez, e o que isso significa desta vez

As 4 sprints anteriores do Bloco 2 usaram "Fase A1" pra dizer "toolkit
completo + 1-2 telas de referência, resto documentado como próxima fase".
Esta sprint é diferente: não há "resto" de telas — é UMA tela (Meu Dash)
com 11 seções pedidas de uma vez, incluindo um redesign visual completo
inspirado em Apple/Aladdin/Bloomberg/Linear/Notion e uma auditoria de
consistência de TODA a plataforma. Isso é, na prática, 2 sprints dentro de
uma: (1) a nova arquitetura de informação e os módulos de composição
(Wealth Health, Attribution, Risco, Coach, Quick Actions — o que responde
"como isso impacta meu patrimônio"), e (2) o redesign visual + consolidação
de Design System cross-plataforma. Esta rodada entrega (1) por completo e
NÃO tenta (2) — ver seção de pendências.

## Módulos entregues (Fase A1)

1. **Wealth Health** (`wealth-health.ts`) — Saúde Patrimonial 0-100 com
   banda (Excelente/Muito Boa/Boa/Regular/Fraca/Muito Fraca), 7 componentes:
   Confluence médio, Carry, Diversificação (concentração), Liquidez,
   Quality Score, Portfolio Fit, Risco. Cada componente vem de um motor
   já existente; a composição (pesos, renormalização por cobertura) é
   nova, mesma categoria de `calcularSaudeCarteira`/`calcularDataQualityScore`
   já existentes. Componente de Risco usa `expectedDrawdown` (Probability
   V2) como proxy — o motor de risco dedicado que a spec pedia ("Risco")
   não existe (`Decision.risk.nivel` é sempre `null`, documentado desde
   antes desta sprint).
2. **Goal Engine** (painel no Meu Dash, reaproveitando `wealth-engine.ts`
   já existente) — CAGR histórico e CAGR real acima do IPCA aparecem REAIS.
   Meta patrimonial/Prazo/Gap ficam "Em desenvolvimento": não existe hoje
   NENHUM lugar no sistema onde registrar uma meta — decidi não escrever
   uma migração nova pra isso agora (ver Pendências).
3. **Performance Attribution** (`portfolio-attribution.ts`) — contribuição
   por posição pra Retorno (peso×resultado real) e Carry/proteção-de-
   inflação (peso×Carry — o próprio dicionário do sistema já define Carry
   como proteção acima da inflação, não são 2 números diferentes) e
   Diversificação (delta real de HHI se a posição fosse removida).
   Volatilidade FICA DE FORA — exigiria matriz de covariância entre
   posições, motor que não existe; mesma disciplina que `wealth-engine.ts`
   já aplica pra não fabricar `probabilidadeAtingirObjetivo`.
4. **Risco da Carteira** (`portfolio-risk.ts`) — lista de ameaças reais
   (concentração alta, maior posição pesada, Carry médio baixo, quality
   baixa, liquidez baixa, FDIE crítico), só aparece o que cruza um limiar
   real; lista vazia é o resultado correto quando nada ameaça.
5. **Wealth Coach + Aprendizados da Carteira** (`portfolio-lessons.ts` +
   reuso de `coach-insights.ts`, Sprint 2.7) — Coach Insight único no Meu
   Dash (maior posição) + até 4 lições geradas comparando a Saúde da
   Carteira ANTES/DEPOIS da posição mais recente (por `data_compra` real,
   migração 016) — diversificação, proteção contra inflação, qualidade
   média, exposição setorial. Os 4 exemplos literais da spec mapeiam 1:1.
6. **Intelligence Capsule do Patrimônio** (`wealth-intelligence-capsule.ts`)
   — topo do Meu Dash, mesma estrutura fixa do Sprint 2.7 (Resumo/Por que
   importa/Oportunidade/Risco/Confiança/Preciso agir), agora composta de
   sinais de carteira (Wealth Health, teses quebradas, FDIE agregado).
7. **Trust Layer** (badge discreto ao lado do Wealth Health) — estrelas
   derivadas do FDIE agregado das posições, nunca ocupa espaço de destaque.
8. **Quick Actions** (`quick-actions.ts`) — reaproveita EXATAMENTE
   `montarDecisoesPrioritarias`/`classificarUrgencia` (decisoes-
   prioritarias.ts, mesma função do Decision Center), só agrupa em 3
   baldes de prazo por urgência. "Baixa" urgência fica fora da fila —
   é rotina, não trabalho pendente.
9. **Oportunidades/Alertas/Performance (Seções 3/6/7)** — já existiam no
   Meu Dash de sprints anteriores e já atendiam a spec quase integralmente
   (Oportunidades já limitada a 3, `GraficoPatrimonio` já plota Carteira/
   CDI/Ibovespa/IPCA na mesma série) — não precisaram de trabalho novo.

## O que NÃO foi entregue nesta rodada (registrado, não escondido)

- **Migração de Meta Patrimonial** — decidi NÃO escrever uma migração nova
  (ex. `024_metas_patrimoniais.sql`) + formulário de UI nesta rodada.
  Justificativa: já existem 2 migrações (022, 023) escritas e paradas há
  3 sprints pelo mesmo bloqueio de conector Supabase; empilhar uma
  terceira sem forma de testar contra o banco real (e sem formulário
  funcional pro Carlos, que não escreve SQL) parecia pior do que deixar o
  Goal Engine estruturalmente pronto mas com o campo específico marcado
  "Em desenvolvimento". Isso é uma DECISÃO DE ESCOPO minha, registrada
  pra você ratificar ou reverter — se preferir que eu escreva a migração
  mesmo assim (fica pronta pra quando o bloqueio resolver), eu escrevo.
- **Contribuição de Volatilidade na Attribution** — exige matriz de
  covariância entre posições; sem esse motor, fabricar um número seria
  o mesmo erro que o Wealth Engine já se recusa a cometer com
  probabilidade de meta.
- **Redesign visual completo (Apple/Aladdin/Bloomberg/Linear/Notion)** —
  apliquei a nova arquitetura de informação (as 11 seções) DENTRO do
  padrão visual que a plataforma já usa (cards em glass, densidade média)
  — não refiz tipografia/grid/paleta do zero. Um redesign de verdade
  precisa de iteração visual com você vendo telas, não só código.
- **Auditoria de UX completa + mapa de componentes reutilizados + lista
  de duplicações eliminadas em TODA a plataforma** — escopo de 5+ telas
  (Meu Dash, Decision Center, Empresas, Truth Layer, Memory Layer);
  esta rodada não fez esse levantamento. Fica pra Fase A2.
- **Histórico mensal/anual/acumulado separado na Performance (Seção 3)**
  — o gráfico já mostra a série acumulada real (Carteira vs CDI/Ibovespa/
  IPCA); quebras mensal/anual como tabelas à parte não foram construídas.

## Autoavaliação obrigatória

**"Se um gestor da Verde, Atmos, Alaska, Dynamo ou IP Capital usasse o
Encorpei por uma semana, quais seriam as 5 maiores críticas?"** — respondendo
sem defender o sistema:

1. **Nenhuma noção de risco de carteira de verdade.** Sem covariância entre
   posições, sem VaR, sem stress test de múltiplas teses quebrando junto.
   Um gestor institucional pensa em risco no nível da carteira, não soma
   de riscos individuais — o Encorpei hoje só faz a soma.
2. **Carry (IPCA+X%) não é como o mercado institucional pensa retorno
   esperado.** Não há prêmio de risco, WACC, custo de capital, CAPM — é
   uma métrica proprietária que não conversa com o vocabulário que esses
   gestores usam todo dia. Pra eles, isso parece "reinventar a roda" sem
   explicar por que a roda nova é melhor.
3. **Meta patrimonial não pode nem ser cadastrada.** Um sistema que se
   chama "Wealth Operating System" e não deixa o usuário definir a própria
   meta é, literalmente, metade do produto faltando.
4. **Zero dado de fluxo, posicionamento de mercado ou book de ordens.**
   100% fundamentalista + técnico simplificado. Um gestor profissional
   pergunta "quem mais está comprando/vendendo isso" — o Encorpei não
   tem resposta nenhuma pra essa pergunta.
5. **Os pesos do Wealth Health (e de boa parte do sistema) são editoriais,
   não validados estatisticamente.** Um gestor quantitativo perguntaria
   "vocês fizeram backtest desses pesos?" — a resposta honesta é não.

**"O que precisamos fazer para eliminar cada uma delas?"**

1. Construir um motor de correlação/covariância entre posições (série de
   retornos já existe via `precos_diarios`) — Research Lab, esforço
   significativo, mas o dado bruto já está no banco.
2. Documentar explicitamente POR QUE o Carry é a métrica escolhida (não
   é CAPM porque o sistema não modela risco sistemático/beta ainda) —
   ou avaliar se vale complementar Carry com um Expected Return estilo
   CAPM quando o motor de covariância acima existir.
3. Escrever a migração de Meta Patrimonial + formulário simples — a
   decisão de não fazer isso nesta sprint foi de escopo/tempo, não de
   dificuldade técnica; é o item mais barato de resolver dos 5.
4. Fora do alcance sem uma fonte de dado paga (fluxo institucional/
   estrangeiro, book de ordens) — já registrado como pendência (Fila do
   Carlos, item de fluxo institucional) há várias sprints.
5. Rodar um backtest histórico dos pesos do Wealth Health contra o
   resultado real da carteira, uma vez que exista série suficiente —
   ou, no mínimo, pedir sua ratificação explícita dos pesos como
   heurística editorial consciente, não pretender que são calibrados.

## Testes

79 arquivos, 620 testes na suíte inteira. Wealth Operating System
especificamente: 6 arquivos novos, 49 testes.

## Pendências (ordem sugerida)

1. Decidir sobre a migração de Meta Patrimonial (ver seção acima).
2. Fase A2: auditoria de UX cross-plataforma + mapa de componentes +
   eliminação de duplicações (Meu Dash, Decision Center, Empresas, Truth
   Layer, Memory Layer).
3. Redesign visual de verdade — precisa de iteração com você vendo telas.
4. Motor de correlação/covariância — destrava Attribution de Volatilidade
   e Wealth Health com componente de risco real (não proxy de drawdown).
5. Ratificar (ou pedir revisão de) os pesos editoriais do Wealth Health.
