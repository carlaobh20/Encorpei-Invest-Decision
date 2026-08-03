# FDIE — Financial Data Integrity Engine: o que entrou, o que ficou de fora, e por quê

**Contexto:** Carlos mandou uma especificação de 20 seções para uma plataforma de
integridade de dados nível "nenhuma fintech brasileira tem isso". Isto aqui é o
registro honesto de decisão — o que virou código em 03/08/2026, o que foi
deliberadamente adiado, e a justificativa de cada corte. Nada foi construído
como enfeite: cada item "fora" tem uma razão concreta (custo, dado que não
existe, ou trabalho que exige julgamento humano, não código).

## O que JÁ EXISTIA antes desta rodada (e cobre pedaços da spec sem eu saber)
- **Camada de dado bruto (seção 3)**: tabela `dados_brutos` grava a resposta
  original da CVM/brapi ANTES de qualquer tratamento — regra 4 do CLAUDE.md
  desde a Fase 1. Não precisou ser criada de novo.
- **Proveniência (regra 5)**: toda tabela de mercado já tem `fonte` e
  `coletado_em`.
- **Gate setorial (seção 10)**: `src/lib/setores.ts` já define, por modelo de
  negócio, quais indicadores são ruído (ex.: banco não tem "dívida líquida"
  nem EBITDA) — usado pelo motor de nota v2 desde a Fase B.
- **View de cobertura/frescor (pedaço da seção 16)**: `/auditoria` já existia
  e mostrava, por empresa, a última data coletada — agora ganhou uma segunda
  seção (ver abaixo).

## O que ENTROU em 03/08/2026 (Fase 1 do FDIE — sem custo novo, sem API paga)
1. **Motor de integridade / verificações cruzadas** (`src/lib/auditoria.ts`,
   seções 17-18 da spec): 5 checagens reais, cada uma comparando dois números
   que o sistema já tem, nunca inventando um terceiro:
   - Valor de mercado: cotação × ações em circulação vs. o valor bruto que a
     brapi devolveu.
   - Margem líquida não pode ser maior que a margem bruta (fato contábil).
   - Margem líquida reportada vs. recalculada (lucro ÷ receita) — é
     exatamente o tipo de checagem que teria pego mais cedo o bug de escala
     do ROIC da INTB3 (31/07).
   - Indicador vazando para um modelo de negócio que o exclui (ex.: ROIC
     aparecendo para um banco).
   - Caixa negativo (impossível — é saldo de conta).
   - Bandas de severidade reaproveitadas literalmente da seção 8/9 do pedido
     original: <2% ok, 2-5% alerta, 5-10% alerta forte, >10% crítico.
   - 15 testes automatizados cobrindo os 5 casos + agregação.
2. **Dashboard de saúde dos dados** (`/auditoria`, seção 16 lite): a tela que
   já existia (frescor por empresa) ganhou uma segunda seção com o resumo do
   motor de integridade — total de verificações, críticas, alertas, e a
   lista de achados (vazia = tudo passou, mostrado explicitamente, não
   escondido).
3. **Audit Mode do Carrego** (`/auditoria/carry/[ticker]`, seção 6, "como foi
   calculado"): fórmula, valores usados (lucro LTM, valor de mercado, ROIC),
   fonte de cada um, e o resultado — acessível clicando no valor do Carrego
   no Radar. Reaproveita o MESMO cálculo do Radar, nunca um número paralelo.

## O que FICOU DE FORA — e a decisão que falta, não o código
Estes itens não foram esquecidos nem "vão sair na próxima sprint" por padrão —
cada um trava numa decisão real que só o Carlos toma, ou num dado que o
pipeline atual simplesmente não tem.

- **Comparação multi-fonte (seção 7) e Quality Score (seção 9) com
  Fundamentus/StatusInvest/TradingView/Yahoo/Alpha Vantage/Polygon**: a
  maioria dessas plataformas não tem API pública gratuita — ou exige
  contrato pago (Alpha Vantage, Polygon), ou exigiria scraping de um site de
  terceiro (risco de ToS e de quebrar sem aviso). **Decisão do Carlos**: vale
  pagar por 1-2 dessas fontes para validação cruzada? Se sim, quais e com
  que orçamento mensal. Sem isso, esta seção não sai do papel — e eu não vou
  simular "comparação" com número inventado, seria o oposto do propósito do
  FDIE.
- **Citação de página de documento (seção 6, exemplo "DFP 2025, Página 76" /
  seção 1, Document Vault de PDFs)**: o pipeline atual lê os dados
  estruturados que a própria CVM publica (arquivos ITR/DFP em formato
  aberto), não escaneia PDF. Não existe "número da página" para citar nesse
  fluxo. Para ter isso de verdade seria preciso um subsistema novo de
  captura e indexação dos PDFs originais (fatos relevantes, releases,
  formulários de referência) — viável, mas é um projeto à parte, não um
  item da lista.
- **Replay Engine (seção 12)** — recalcular qualquer indicador "como se
  fosse" uma data passada, só com o que existia até ali: o dado já é
  versionado por competência, então é factível, mas exige decidir a regra de
  corte (o que "existia" numa data — a CVM às vezes republica trimestres).
  Fica para quando o Carlos quiser esse recurso especificamente — não é pré-
  requisito de nada que está em uso hoje.
- **Formula Validation contra empresas conhecidas (seção 11)**: testar cada
  fórmula (Carry, ROIC, P/L) contra WEG/Itaú/Vale/Petrobras/Sabesp/Raia/
  Totvs exige alguém (o Carlos, ou eu com a orientação dele) validar os
  números "certos" de referência manualmente — não é algo que se automatiza
  sem esse insumo humano primeiro.
- **Explainability Engine completo (seção 19)** — "o que é / quando NÃO
  usar / limitações" por indicador, redigido — é conteúdo, não engenharia;
  fica junto do próximo lote de indicadores documentados (P/L, ROE, P/VP já
  aparecem no sistema; falta o texto explicativo de cada um).
- **Consistency Engine mais amplo (seção 18, itens que não entraram)**:
  ex. "empresa de software nunca pode usar EV/Reservas" — o sistema não
  calcula EV/Reservas hoje, não há o que auditar ainda.

## Como isso se conecta ao que já existia
O Carry Engine (v1/v2, `src/lib/carry/`) já seguia praticamente todos os
princípios do FDIE desde que foi construído: fórmula fixa e documentada,
gate de honestidade (devolve null em vez de estimar), fatores explicados em
português. A Fase 1 do FDIE não reescreveu nada disso — só expôs o que já
existia (Audit Mode) e adicionou uma camada de verificação cruzada que não
existia (Motor de integridade).

## Próximo passo se o Carlos quiser continuar
Decidir, nesta ordem de valor por esforço: (1) se vale contratar alguma API
paga para comparação multi-fonte — e qual; (2) se o Document Vault de PDFs
(fatos relevantes, releases) vale o esforço de um subsistema novo agora ou
mais para frente; (3) revisar os 5 achados de integridade no dashboard
`/auditoria` sempre que a coleta rodar, para o Motor de integridade virar
hábito, não só uma tela que existe.
