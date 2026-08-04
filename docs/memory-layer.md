# Memory Layer — Bloco 2, Sprint 2.3

## O que é

Camada que transforma dados JÁ coletados por fontes reais (CVM, BCB, Carry
Engine) em `Evidence` — registros de fato, imutáveis, com proveniência,
persistidos na tabela `evidencias` (Foundation v3.1, migração 021).

**Não é um coletor de dado bruto novo.** A coleta de dado bruto (IPE, Focus,
DFP/ITR, Carry) já existe e já roda em produção, de sprints anteriores. Esta
sprint construiu a camada que faltava entre "dado bruto já coletado" e
"evidência estruturada, deduplicada, auditável" que o Evidence Engine
(Foundation, congelado) sempre esperou receber mas nunca recebeu.

## Por que o Foundation continua congelado

`src/lib/evidence.ts` (tipo `Evidencia`, `EvidenciaCategoria`, função
`montarEvidencia`) não foi alterado. A Memory Layer só chama essas funções
já existentes e adiciona, por fora, uma camada de:

1. **Deduplicação** (`src/lib/memory-layer.ts`) — decide se uma evidência
   candidata já existe (chave: ticker+categoria+origem+data+hash) antes de
   persistir.
2. **Campos de exibição** (migração 023: `subcategoria`, `titulo`,
   `url_oficial`, `documento_oficial`) — colunas novas na tabela
   `evidencias`, nunca lidas por nenhum motor do Foundation (cause-effect.ts,
   evidence-weight.ts, thesis-engine.ts, decision-object.ts,
   predictive-factor-registry.ts continuam lendo só os campos que já liam).
3. **Log de coleta** (`evidencias_coleta_log`, migração 023) — auditoria de
   quando cada coletor rodou, quanto gerou de novo, duplicado e erro.

## Arquitetura

```
Fonte já coletada          Emissor (puro, testado)         Persistência
─────────────────          ────────────────────────         ────────────
comunicados_oficiais  ──►  memory-layer-comunicados.ts  ─┐
macro_focus           ──►  memory-layer-macro.ts        ─┤
fundamentos (DFP/ITR) ──►  memory-layer-resultados.ts   ─┼─►  montarEvidenciaEnriquecida()
carry_score           ──►  memory-layer-carry.ts        ─┘         │
                                                                     ▼
                                                        filtrarEvidenciasNovas() (dedup)
                                                                     │
                                                                     ▼
                                                    /api/evidencias/coletar (rota)
                                                                     │
                                              ┌──────────────────────┴──────────────────────┐
                                              ▼                                              ▼
                                        evidencias (insert)                    evidencias_coleta_log (insert)
```

Cada emissor é uma função pura: recebe linhas já lidas do banco, devolve
candidatas a Evidence. Nenhum emissor faz I/O — isso fica só na rota
`/api/evidencias/coletar/route.ts`, que lê as fontes, chama os 4 emissores,
deduplica contra o que já existe (e contra o próprio lote da rodada) e
insere o que sobrar.

## Coletores implementados (Fase A)

| Coletor da spec | Fonte real (já existente) | Categoria Evidence | Observação |
|---|---|---|---|
| 1 — Comunicados (Fato Relevante, Comunicado, Apresentação) | `comunicados_oficiais` (tools/coleta_ipe.py, cron diário 07h BRT) | `outro` | Enum congelado não tem categoria dedicada para comunicado genérico; classificação mais rica vai só em `subcategoria` (exibição). `pesoInformativo` sempre 0 — nunca interpreta se o fato é bom ou ruim. |
| 8 — Macro (Focus: Selic/IPCA/PIB/Câmbio) | `macro_focus` (tools/coleta_focus.py, cron semanal segunda 09h BRT) | `macro_focus` | Fan-out: uma evidência por empresa do universo (FK obrigatória `ticker→empresas`). |
| 9 — Resultados (Receita/Margem/ROIC) | `fundamentos` (tools/backfill_cvm.py, cron dias úteis) | `receita` / `margem` / `roic` | Limiar: 10% de variação relativa entre competências consecutivas. |
| 9 — Resultados (Lucro) | `fundamentos` | `outro` | Enum congelado não tem categoria "lucro" — ver Pendências. |
| 9 — Resultados (Carry) | `carry_score` (migração 009, cron de avaliação diário) | `outro` | Mesmo motivo do Lucro — ver Pendências. |

## Coletores NÃO implementados nesta sprint (Fase B)

| Coletor da spec | Motivo |
|---|---|
| 4 — Formulário de Referência (controlador/diretores/conselho/remuneração) | Fonte CVM (FRE) nunca integrada. Trabalho de integração nova, não adaptação. |
| 7 — Controlador (compra/venda de participação) | Depende do formulário VLMO da CVM; `erl.cobertura_dados` já registrava isso como "não pesquisado" antes desta sprint — segue não pesquisado. |
| 12 — Setor (liderança/market share/concorrência/M&A) | Não existe fonte de dado dinâmica hoje. `sector-intelligence` (migração 013) é classificação estática (modelo de negócio por empresa), não um feed de eventos de mercado. Sem decisão de fonte (paga ou não), este coletor fica sem implementação — não foi fabricado. |
| 11 — Técnico (Golden Cross, rompimentos etc.) | Lógica existe em `src/lib/tecnica.ts` (retirada da tela de Empresas na Sprint 2.2 por redesign), mas não foi conectada como emissor de Evidence nesta sprint — pendência explícita. |
| 5/6 — Dividendos / Recompra | Fonte de granularidade (pagamento individual, programa/execução) não confirmada dentro do tempo desta sprint. |
| 2/3 — DFP/ITR como coletores dedicados | Cobertos indiretamente pelo coletor de Resultados (mesma fonte, `fundamentos`) — não há coletor de evidência "documento chegou" isolado do coletor "indicador mudou". |
| 10 — Valuation (P/L, EV/EBITDA, P/VP) | Não encontrei um cálculo já isolado e reutilizável como série por ticker no tempo dentro do prazo desta sprint. Deferido para não fabricar sobre fonte não confirmada. |

## Deduplicação

Chave: `ticker + categoria + origem + data + hash`. `hash` vem de
`hashPayload()` (já existente, `src/lib/proveniencia.ts`), aplicado sobre o
payload bruto de cada emissor. Dupla defesa: checagem em código
(`filtrarEvidenciasNovas`, roda antes do insert) + índice único no banco
(`evidencias_dedup_idx`, migração 023).

## Integração com o Foundation

Nenhuma. Por decisão explícita da spec ("O Foundation apenas consumirá"),
esta sprint não alterou nenhum motor consumidor (Cause & Effect, Explanation
Engine, Thesis Engine, Decision Object). A tabela `evidencias` estava vazia
em produção antes desta sprint; a partir da primeira execução de
`/api/evidencias/coletar`, ela passa a ter linhas reais, e os motores que já
sabem ler evidência (mas nunca tinham o que ler) passam a ter dado de
verdade — sem qualquer mudança de código nesses motores.

## Auditoria

Painel em `/auditoria/memoria` (`src/app/auditoria/memoria/page.tsx`) —
contagem total/ativas/últimos 30 dias, por empresa, categoria, origem,
confiabilidade, e histórico de execuções por coletor (novas/duplicadas/
erros). Agregação pura e testada em `src/lib/memory-layer-auditoria.ts`.

## Limitações

- A rota `/api/evidencias/coletar` existe e está testável por tipo/lint/
  build, mas **não foi verificada contra o banco em produção** — a migração
  023 também não foi aplicada ainda (ver Pendências).
- Nenhum agendamento (cron) foi criado para a rota — chamada manual com o
  mesmo secret dos outros crons, até decidir o horário (precisa rodar depois
  de IPE 07h, backfill CVM 09h, Focus segunda 09h BRT).
- "Lucro" e "Carry" nascem como categoria `outro` — decisão de estender
  `EvidenciaCategoria` (precedente: "custos" foi adicionado assim no
  Foundation v4) não foi tomada nesta sprint, ver Pendências.

## Pendências (ordem sugerida)

1. **Aplicar a migração 023** — Supabase MCP deste ambiente só está
   autorizado no projeto errado ("Viagem - EUA"); precisa ou reautorizar
   para o projeto ENCORPEITECH (dbxblgrubdsskkcrvusu), ou aplicar via SQL
   Editor no navegador do Carlos (método já documentado na skill do
   projeto).
2. Rodar `/api/evidencias/coletar` manualmente uma vez e conferir
   `/auditoria/memoria`.
3. Decidir se estende `EvidenciaCategoria` com `"lucro"` e `"carry"`
   (mudança aditiva, mesmo precedente de `"custos"`) — ratificação explícita
   pedida por causa do "NÃO ALTERAR CARRY" da spec, mesmo sendo só uma
   categoria de evidência sobre Carry, não a fórmula.
4. Decidir o horário do cron da rota de coleta.
5. Fase B: Formulário de Referência + Controlador (integração CVM nova),
   Setor (decidir fonte ou descartar o coletor), Técnico (conectar
   `tecnica.ts` como emissor), Dividendos/Recompra (confirmar granularidade),
   Valuation (localizar cálculo reutilizável).

## Testes

58 arquivos de teste, 478 testes, suíte inteira. Memory Layer especificamente:
6 arquivos, 29 testes, cobertura ≥98% em statements/lines, 100% em branches
nos arquivos novos (`memory-layer.ts`, `memory-layer-comunicados.ts`,
`memory-layer-macro.ts`, `memory-layer-resultados.ts`, `memory-layer-carry.ts`,
`memory-layer-auditoria.ts`).
