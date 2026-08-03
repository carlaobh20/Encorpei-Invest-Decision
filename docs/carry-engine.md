# Encorpei Carry Engine — Documento Técnico

Versão do documento: 2 · 03/08/2026 · Princípios: nenhum cálculo escondido,
nenhuma IA no número, nenhum peso secreto, tudo reproduzível e versionado.

## Nomenclatura (decisão de produto, 03/08/2026)

O conceito-destino da plataforma é o **Retorno Intrínseco Encorpei** (nível 5).
"Taxa de Carrego / Carry Floor" permanece como métrica interna e primeiro
degrau. A interface só chamará algo de "Retorno Intrínseco" quando o nível 5
existir com dados reais — nunca antes.

## A escada (5 níveis — todos sempre visíveis, cada um no seu estado real)

### Nível 1 — Carry Floor (v1) · EM PRODUÇÃO
```
carry_floor = lucro_12m ÷ valor_de_mercado
```
- lucro_12m: DFP anual + ITRs posteriores − ITRs equivalentes do ano anterior
  (conta 3.11.01, controladores). Fonte: dados abertos CVM, coleta diária.
- valor_de_mercado: fechamento (brapi) × nº total de ações (composição de
  capital da CVM, escala normalizada por lucro/ação; brapi só fallback).
- Leitura "IPCA + X%": lucros tendem a acompanhar a inflação; o rendimento
  do lucro aproxima o retorno REAL num cenário SEM crescimento — por isso
  "piso, o pior cenário". NUNCA será alterado nem removido.
- Limitações declaradas: lucro contábil ≠ caixa; 12 meses podem conter
  não-recorrentes; financeiras têm confiança rebaixada.

### Nível 2 — Carry Growth (v2) · CÓDIGO PRONTO, AGUARDA DADO
```
payout    = |dividendos+JCP pagos 12m| ÷ lucro_12m     (limitado a 0..1)
retenção  = 1 − payout
carry_growth = (carry_floor × payout) + (retenção × ROIC_4tri)
```
- Intuição: a fatia distribuída rende o yield de hoje; a fatia retida é
  reinvestida à taxa de retorno do capital da própria empresa.
- Propriedade honesta: se ROIC < carry_floor, reter DESTRÓI valor e o
  Growth fica ABAIXO do Floor — o sistema mostra isso, não esconde.
- Dado que destrava: dividendos+JCP pagos, lidos da DFC consolidada
  (contas 6.03.x) — extração JÁ implementada no backfill diário; entra no
  banco com a migração 011.

### Nível 3 — Carry Cash (v3) · PLANEJADO
Substitui lucro contábil por caixa econômico:
```
fcf_aprox = caixa_operacional_12m (6.01) − capex_12m (linhas de
            imobilizado/intangível do 6.02)
carry_cash = fcf_aprox ÷ valor_de_mercado  (+ variante growth com retenção)
```
- Atenção metodológica registrada: ITR de DFC é ACUMULADA no ano (jan→fim
  do trimestre) — a montagem de 12m usa DFP + acumulados com períodos
  explícitos (colunas inicio/dias na tabela fluxo_caixa).
- Calibração contra casos conhecidos antes de ligar (mesma disciplina da
  auditoria de valuation de 01/08).

### Nível 4 — Carry Allocation (v4) · PLANEJADO
Mede o que chega ao acionista: dividendos + recompras (6.03) − diluição
(variação do nº de ações na composição de capital ao longo do tempo).
Requer histórico acumulado de composição de capital (coleta diária começou
em 02/08/2026 — o acervo cresce sozinho).

### Nível 5 — Retorno Intrínseco (v5) · O DESTINO
Integra 1-4 + risco/previsibilidade. Regra de entrada: SÓ nasce quando os
níveis 2-4 existirem com dados reais e a integração for uma fórmula
publicada neste documento — nunca uma média de notas 0-100 disfarçada de
retorno. Cenários (conservador = Floor · base = Growth/Cash · otimista =
limitado pelo melhor histórico REAL da própria empresa) entram junto.

## O que foi deliberadamente rejeitado
- Estrelas/percentuais de convicção sem track record (decoração).
- "Histórico de 10 anos" (a série oficial carregada começa em 2024; o
  histórico REAL acumula a partir da migração 009 — gravação diária).
- Qualquer mapeamento arbitrário nota→retorno.

## Testes (vitest, rodam no CI a cada push)
Fórmulas v1 e v2 com casos numéricos; gates de dado ausente (null, nunca
chute); payout>100% limitado; ROIC baixo rebaixando o Growth; determinismo;
TRAVA DE LINGUAGEM (falha se qualquer texto prometer retorno ou ordenar
compra/venda — "garantido" só existe negado).

## Versionamento
CarryCalculator é uma interface plugável; cada metodologia é uma versão
registrada (src/lib/carry/index.ts). Versão nova NUNCA edita a antiga.
Histórico diário imutável em carry_score (migração 009) permite reprocessar
e comparar metodologias para sempre.
