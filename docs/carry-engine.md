# Encorpei Carry Engine — Documento Técnico

Versão do documento: 3 · 03/08/2026 · Princípios: nenhum cálculo escondido,
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

### Nível 2 — Carry Growth (v2) · EM PRODUÇÃO (03/08/2026, mesma tarde)
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
  (contas 6.03.x) — coletado desde a migração 011. **Bug corrigido em
  03/08/2026:** o cálculo estava correto, mas `/comparar` passava `null`
  fixo em vez do dado já coletado — a escada nunca via o número que já
  existia no banco. Wiring corrigido, sem coleta nova necessária.

### Nível 3 — Carry Cash (v3) · EM PRODUÇÃO (03/08/2026, mesma tarde)
Substitui lucro contábil por caixa econômico:
```
fcf_aprox = caixa_operacional_12m (6.01) + capex_12m (6.02, já negativo
            na DFC — somar com sinal já subtrai o capex)
carry_cash = fcf_aprox ÷ valor_de_mercado
```
- Atenção metodológica: ITR de DFC é ACUMULADA no ano (jan→fim do
  trimestre) — a montagem de 12m reusa `ltmCampo` (mesma função do
  Floor/Growth), que já cancela corretamente o acumulado do ano anterior
  equivalente; não precisou de lógica nova para isso.
- Confiança rebaixada para financeiras (caixa operacional de banco mistura
  captação/aplicação, não é comparável a caixa de empresa não financeira).
- Variante growth (retenção sobre caixa em vez de lucro) fica para quando
  o nível 3 tiver uso real — não implementada agora para não adicionar
  complexidade sem necessidade comprovada.

### Nível 4 — Carry Allocation (v4) · BLOQUEADO POR TEMPO, NÃO POR DADO
Mede o que chega ao acionista: dividendos + recompras (6.03) − diluição
(variação do nº de ações na composição de capital ao longo do tempo).
Requer histórico acumulado de composição de capital — a coleta diária
começou em 02/08/2026, então hoje existe ~1 dia de série. Não há site nem
fonte para "buscar" isso: diluição só se mede comparando pontos no tempo,
e o acervo cresce sozinho, um dia por vez, com o robô diário já rodando.
Reavaliar quando a série tiver alguns meses.

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
Fórmulas v1, v2 e v3 com casos numéricos; gates de dado ausente (null,
nunca chute); payout>100% limitado; ROIC baixo rebaixando o Growth; caixa
negativo virando fator de atenção explícito; determinismo; TRAVA DE
LINGUAGEM em todas as versões (falha se qualquer texto prometer retorno ou
ordenar compra/venda — "garantido" só existe negado).

## Versionamento
CarryCalculator é uma interface plugável; cada metodologia é uma versão
registrada (src/lib/carry/index.ts). Versão nova NUNCA edita a antiga.
Histórico diário imutável em carry_score (migração 009) permite reprocessar
e comparar metodologias para sempre.
