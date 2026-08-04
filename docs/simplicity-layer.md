# Simplicity Layer — Bloco 2, Sprint 2.5 (Fase A1)

## O que é

Camada de vocabulário e apresentação — não cria motor, não cria
indicador, não altera Confluence/Carry/Decision Object/Truth Layer. Traduz
o que esses motores já calculam para linguagem de investidor.

## Por que "Fase A1" e não a sprint inteira

"Revisar TODAS as telas já implementadas" (Meu Dash, Decision Center,
Empresas, Truth Layer, Memory Layer) com 4 níveis de informação + botões
"Por quê?"/"Como calculamos?" em todo bloco + 3 modos de visualização, de
uma vez, não é uma sprint — é um redesign completo de 5 telas em produção.
Fazer isso raso em todas seria pior que fazer fundo em uma e documentar o
resto. Esta rodada entrega o TOOLKIT (dicionário, cores, convicção,
estados técnicos, componente "Por quê?/Como calculamos?") e aplica numa
única tela de referência.

## Dois achados que mudaram o que precisava ser construído

1. **"Convicção" e "Technical Score" já existem, congelados.**
   `confluencia.ts` já tem `Conviccao` (4 níveis, via
   `classificarConviccao`) e um `technicalScore` (0-100, componente do
   Confluence v2). A spec pede 7 rótulos de convicção e 6 estados
   técnicos — construídos como mapeamento SOBRE esses números já
   calculados, nunca recalculando.
2. **Análise Técnica por estado único era uma tensão real com "não cria
   indicadores".** `tecnica.ts` devolve uma LISTA de leituras (RSI,
   tendência, distância da máxima, variação mensal), não um score único —
   combiná-las numa fórmula nova seria criar um indicador. Resolvido
   usando o `technicalScore` que já é a agregação (Confluence v2).

## Módulos entregues

- **Dicionário oficial** (`src/lib/simplicity-dicionario.ts`) — 9 termos
  canônicos (Tese/Confluence/Carry/Portfolio Fit/Convicção/Catalisador/
  Risco/Replay/Investment Story) + tradução de 10 indicadores ("o que isso
  significa", incluindo os 3 exemplos literais da spec: Carry/ROIC/P-L).
- **Sistema de cores** (`src/lib/simplicity-cores.ts`) — 6 estados
  canônicos (cinza/azul/verde/amarelo/laranja/vermelho) + 3 mapeamentos de
  conveniência sobre estados que já existiam (severidade FDIE, urgência
  do Decision Center, tendência de nota) — "nunca vermelho para oscilação
  normal" aplicado (tendência "descendo" vira amarelo, nunca vermelho).
- **Sistema de Convicção** (`src/lib/simplicity-conviccao.ts`) — mapeia
  `Conviccao` + score + componentesDisponiveis pros 7 rótulos. Convicção
  Máxima exige score ≥95 E todos os componentes disponíveis — rara por
  construção.
- **Estados de Análise Técnica** (`src/lib/simplicity-estados-tecnicos.ts`)
  — mapeia `technicalScore` pros 6 estados, `null` sempre vira "Sem sinal".
- **Componente "Por quê?/Como calculamos?"** (`src/components/
  PorQueComoCalculamos.tsx`) — dois `<details>` reutilizáveis, nunca abrem
  sozinhos.
- **Aplicação de referência:** `/decisoes` (Decision Center) — o painel
  "Por que esta decisão?" existente foi reescrito para usar o componente
  novo, mesmo dado real de sempre (`Decision.explanation`/`evidences`/
  `probability`/`expectedReturn`), agora separado em "Por quê?" (dados/
  motores/evidências/hipóteses/limitações) e "Como calculamos?" (fórmula
  real do Confluence v2, origem, versão, data).

## O que NÃO foi entregue nesta rodada (registrado, não escondido)

- Retrofit de Meu Dash, Empresas, Truth Layer e Memory Layer com o mesmo
  padrão — Fase A2/A3.
- 4 níveis de informação (Resumo/Explicação/Auditoria/Reprodução) como
  estrutura aplicada de fato — hoje o toolkit cobre Explicação (Por quê)
  e parte de Auditoria/Reprodução (Como calculamos); Resumo executivo por
  página e a divisão formal em 4 camadas visuais ficam para a Fase A2.
- Modo Executivo/Analista/Auditor — feature real de toggle de estado,
  tamanho próprio, não cabe nesta rodada.
- Resumos executivos por página (Empresa/Carteira/Decision Center/
  Research) — Decision Center já responde isso implicitamente pelo hero
  existente; as outras 4 perguntas da spec ficam pra Fase A2.

## Autoavaliação crítica — "quais partes ainda parecem feitas para engenheiros?"

Sem esconder nenhuma, contagem real feita por grep nas 5 telas já em
produção (termos como FDIE, Master Engine, Decision Object, "Foundation
v2/v3/v4", Confluence Score, Probability V2, Evidence Engine expostos
literalmente na interface, não só em comentário de código):

- **Meu Dash (`/`): 15 ocorrências.** O pior caso — tooltip "Foundation
  v2" e rótulos de motor aparecem na tela que é a porta de entrada do
  sistema.
- **Empresas (`/tese/[ticker]`): 17 ocorrências.** Pior ainda em termos
  absolutos — a tela mais densa em conteúdo (13 seções) também é a mais
  densa em jargão técnico exposto (nomes de motor nos textos de corte
  honesto, ex. "Cause & Effect Engine", "Wealth Engine").
- **Decision Center (`/decisoes`): 2 ocorrências**, já reduzido nesta
  sprint (o painel reescrito não usa mais "Confluence Score" cru, usa a
  fórmula em português).
- **Truth Layer (`/auditoria/verdade`): 1 ocorrência.**
- **Memory Layer (`/auditoria/memoria`): 0 ocorrências** — a mais limpa
  das 5, por ser a mais nova e já nascer sem nomear motor na interface.

**Leitura honesta:** o corte honesto do projeto ("nunca esconder por que
um dado não existe") tem um efeito colateral direto — o texto que explica
a ausência de um motor CITA o motor pelo nome de engenharia
("Cause & Effect Engine", "Wealth Engine", "FDIE"), porque é assim que o
time (eu e o Carlos) se refere a eles no código e no roadmap. Isso é
correto para o Carlos (que lê o roadmap e sabe o que cada motor é), mas
não é linguagem de investidor — é linguagem de quem construiu o sistema.
Resolver isso de verdade exige o dicionário passar a ser USADO nesses
textos de corte honesto, não só existir — trabalho real de Fase A2/A3,
tela por tela.

## Testes

68 arquivos, 546 testes na suíte inteira. Simplicity Layer especificamente:
5 arquivos novos, 29 testes.

## Pendências (ordem sugerida)

1. Fase A2: retrofit de Meu Dash e Empresas com o dicionário — maior
   densidade de jargão, maior ganho.
2. Fase A2: retrofit de Truth Layer e Memory Layer (menor esforço, já
   estão mais limpas).
3. Modo Executivo/Analista/Auditor — decidir se entra na Fase A3.
4. Resumos executivos por página (Empresa/Carteira/Research).
