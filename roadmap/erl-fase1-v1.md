# Encorpei Research Lab (ERL) — Fase 1: arquitetura, decisão registrada

**O que é:** Carlos mandou a especificação completa do ERL — 19 camadas,
de um banco histórico temporal até motores de descoberta de padrões,
poder preditivo, probabilidade, otimização de pesos e um dashboard
próprio. A filosofia é clara e correta: o Encorpei não vai mais só
estudar empresas, vai estudar **como o mercado funciona**, com aprovação
humana obrigatória antes de qualquer mudança em produção. Registro aqui
por que a Fase 1 é só a arquitetura, e não o laboratório inteiro.

## A premissa que precisa ficar visível antes de qualquer coisa

Toda a promessa do ERL — "82% das vezes", "score preditivo 91",
"significância estatística" — só tem valor se houver **profundidade
histórica real** por trás. Hoje, no banco do Encorpei:

- Fundamentos (`fundamentos`): só 2024-2025 (backfill atual,
  `tools/backfill_cvm.py`, `ANOS_DFP=[2024,2025]`).
- Preços diários: gravação começou há dias (regra de fundação —
  histórico REAL acumula a partir da coleta diária, não é retroativo).
- Fluxo de caixa (DFC): só a partir da migração 011 (03/08/2026).
- Composição de capital (pra medir diluição): coleta diária começou
  02/08/2026 — 1 dia de histórico.

Rodar Pattern Discovery, Predictive Power ou Probability Engine sobre
essa janela produziria números como "score preditivo 91" que na
verdade vêm de meia dúzia de trimestres — estatisticamente inúteis, e
pior: pareceriam confiáveis. Isso violaria a própria regra que o Carlos
escreveu na spec ("nunca apresentar conclusões sem evidência",
"margem de erro", "confiabilidade"). Construir essas camadas agora
seria construir a caixa preta que a spec proíbe.

## Investigação de viabilidade (feita antes de decidir o escopo)

Confirmado ao vivo (dados.cvm.gov.br, 03/08/2026): **DFP e ITR da CVM
existem de 2010 a 2026, de graça, no mesmo formato que o backfill já
sabe ler.** O pipeline atual só usa 2024-2025 por escolha, não por
limitação da fonte — expandir é viável, mas precisa de validação (o
padrão de contas pode variar em anos mais antigos; nunca confiar sem
checar, mesma disciplina da auditoria de 03/08).

BCB SGS (CDI, IPCA, Selic) tem décadas de histórico público — o
coletor atual (`tools/coleta_benchmarks.py`) só puxa uma janela
recente por design (atualização diária), não por limite da fonte.

brapi (preços/candles): tem parâmetro de range até anos, mas não ficou
claro na documentação pública se o plano atual do Carlos permite
profundidade grande — fica em aberto, precisa checar no dashboard da
conta.

Fluxo institucional e consenso de analistas: **mesma decisão pendente
desde o PIC 01** (item 15 da fila) — precisam de fonte paga. Sem isso,
os fatores Fluxo e Consensus do ERL (camada 6) ficam ausentes,
documentados, não inventados.

Controlador (movimentação de administradores/controladores): a CVM
publica isso via formulário VLMO, possivelmente já tocado pelo coletor
de IPE que já roda às 07h — precisa checar se o filtro atual inclui
essa categoria. Não pesquisado ainda.

## Decisão de escopo (registrada — foi minha)

**Fase 1 constrói só a arquitetura e o mecanismo de governança — não o
laboratório quantitativo em si:**

1. **Schema isolado `erl`** (migração 019, aplicada e verificada) —
   separado do `public` (produção). Interpretação da regra "nunca
   compartilhar banco com o Production Engine": isolamento por schema
   + RLS dentro do MESMO projeto Supabase, não um projeto novo — um
   projeto Supabase novo teria custo e mais uma conta pro Carlos
   configurar, sem necessidade comprovada ainda. Se isso mudar
   (volume de dado, ou Carlos preferir isolamento físico total), é
   decisão dele, registrada aqui como aberta.
2. **`erl.hipoteses`** (Research Notebook, camada 12) — toda hipótese
   testada entra aqui pra sempre, com status `em_teste` / `validado` /
   `descartado`. Nunca DELETE (mesma disciplina de `eventos_tese`).
3. **`erl.aprovacoes`** (Research Approval, camada 15) — o mecanismo
   mais importante da spec: nenhuma descoberta vira mudança de
   produção sem uma linha aqui com `aprovado=true` e `aprovado_por`
   preenchido à mão. Construído ANTES de qualquer motor de descoberta
   existir, de propósito — a trava vem primeiro, nunca depois.
4. **`erl.cobertura_dados`** (metadado da camada 1, não os dados em
   si) — registro honesto de profundidade real por fonte, pra nenhuma
   camada futura apresentar probabilidade sobre janela de dado
   pequena demais sem isso ficar visível. 8 fontes já catalogadas com
   o resultado da investigação acima.

## O que NÃO entrou nesta fase — e por quê

- **Historical Database com dado de verdade (camada 1, execução):**
  expandir `backfill_cvm.py` pra 2010+ é o próximo passo natural, mas
  NÃO fiz agora — reescrever o range de anos sem validar se o parser
  lê corretamente os formatos mais antigos arriscaria contaminar
  `fundamentos` com dado mal-interpretado, apresentado como real. Isso
  seria repetir o erro do caso Bradesco/Sabesp de propósito. Precisa
  de uma rodada de validação (amostra de poucos anos antigos,
  conferir contra números conhecidos) antes de rodar em produção.
- **Time Machine (camada 2), Feature Store (camada 3):** dependem de
  saber o formato real do dado histórico expandido — construir antes
  seria desenhar o schema no escuro.
- **Camadas 4-14 (Pattern Discovery, Predictive Power, Factor
  Research, Weight Optimization, Regime Detection, False
  Positive/Negative, Decision Replay, Probability/Evidence Engine):**
  todas dependem de profundidade histórica que não existe ainda.
  Construir agora seria produzir números com aparência de rigor
  estatístico sobre uma amostra pequena demais — a caixa preta que a
  spec proíbe.
- **Camada 17 (Research Dashboard):** sem hipóteses reais pra mostrar,
  seria uma tela vazia. Fica pra quando `erl.hipoteses` tiver conteúdo.

## Próximos passos concretos (nesta ordem)

1. Validar o parser da CVM contra 2-3 anos antigos (ex.: 2018, 2015) —
   comparar números extraídos com o que está publicamente disponível,
   antes de confiar.
2. Se validar: expandir `ANOS_DFP`/`ANOS_ITR` com prudência (não direto
   pra 2010 — em blocos, revisando o relatório que o próprio script já
   gera a cada rodada).
3. Expandir `coleta_benchmarks.py` pra puxar o histórico completo do
   BCB SGS (CDI/IPCA/Selic) — sem risco de formato, é a mesma API, só
   muda a janela de datas.
4. Checar o plano da conta brapi do Carlos pra saber a profundidade
   real de preços disponível sem custo adicional.
5. Só depois disso: Time Machine e Feature Store — reconstrução
   ponto-no-tempo sem look-ahead bias, testada com casos conhecidos.

## Versionamento

Esquema `erl` é aditivo e isolado — mudanças futuras nunca tocam
`public` (produção). Migração 019 documentada; próximas migrações do
ERL seguem a numeração sequencial normal do projeto.
