# Compounder Engine v1 — metodologia, decisão de escopo, e o que ficou de fora

**O que é:** o Compounder Score é uma metodologia PROPRIETÁRIA do Encorpei
para classificar empresas pela capacidade de MULTIPLICAR patrimônio ao
longo de muitos anos — não de "crescer" num trimestre, não de pagar bom
dividendo, não de estar barata. É uma categoria própria, nunca misturada
com os motores de Value, Dividendos ou Carry. Nenhum resultado futuro é
garantido; o objetivo é classificar por fundamentos consistentes e
auditáveis, com o mesmo "corte honesto" que rege todo o resto do sistema.

## Decisão de escopo (registrada, porque foi minha, não do Carlos)

Carlos pediu para eu decidir o melhor caminho e depois implementar a
especificação. A especificação original tem ~20 seções, incluindo backtest
contra 2015/2018/2020/2022 e S&P500, um módulo de IA ("Growth Thesis"), e
uma carteira modelo executável. Antes de construir, chequei o que o sistema
realmente tem hoje:

- **Só ~2 anos de DFP coletados** (`tools/backfill_cvm.py`, `ANOS_DFP =
  [2024, 2025]`). CAGR de 3/5/10 anos, pedido em vários componentes da
  spec, é matematicamente impossível com essa profundidade — não dá nem
  para CAGR de 3 anos direito.
- **Nenhuma coleta de S&P500** e nenhum histórico de preço anterior a
  poucos meses — backtest 2015-2022 comparando com Ibovespa/CDI/IPCA/S&P500
  não tem matéria-prima nenhuma hoje.
- **`ANTHROPIC_API_KEY` não configurada** — está na fila do Carlos desde
  antes desta rodada. O módulo de IA "Growth Thesis" pedido na spec
  depende exatamente disso.
- **`acoes_totais` não versiona histórico** — cada coleta SOBRESCREVE o
  número de ações por ticker (upsert com `onConflict: "ticker"`, sem data).
  Não dá para medir emissão de ações ao longo do tempo, só se houve
  RECOMPRA no período (dado da DFC, esse sim real).
- **Regra 7 do CLAUDE.md, com trava no CI**: proibido linguagem de
  "compre/venda" ou recomendação. Uma "carteira modelo" com pesos
  sugeridos por ticker fica perigosamente perto dessa linha — decidi NÃO
  implementar isso nesta v1 até o Carlos confirmar como fica o texto sem
  esbarrar na regra.

Por isso, esta v1 entrega o MOTOR (score, componentes, página própria,
sensibilidade a juros, comparador) com dado 100% real, e deixa de fora — de
forma explícita, não silenciosa — tudo que dependeria de fabricar número ou
tocar numa decisão que não é minha (custo de API, ou o texto de uma
"carteira modelo").

## O Compounder Score (0-100)

Score = média ponderada dos componentes com dado disponível, com o peso
dos componentes FALTANTES redistribuído entre os disponíveis (nunca um
buraco vira nota inventada). Toda empresa mostra `componentesDisponiveis`
de 8 — nunca finge ter mais dado do que tem.

| # | Componente | Peso | Fonte do dado nesta v1 |
|---|---|---|---|
| 1 | Growth Quality | 25% | Receita e lucro do último DFP vs. o anterior — **crescimento de 1 ano**, rotulado assim na tela, nunca chamado de CAGR |
| 2 | ROIC | 20% | Média dos últimos 4 trimestres (mesma régua dos gatilhos de tese) |
| 3 | Capacidade de Reinvestimento | 15% | Retenção do lucro = 1 − payout (dividendos+JCP ÷ lucro, DFC oficial) |
| 4 | Fluxo de Caixa (FCF) | 15% | Caixa operacional − capex (DFC), como yield sobre valor de mercado e como conversão de lucro em caixa |
| 5 | Expansão de Margens | 10% | Delta da margem líquida entre o trimestre mais recente e o mais antigo disponível (janela curta, nunca anos) |
| 6 | Qualidade da Gestão | 5% | **Sem proxy honesto hoje — fica nula.** Exige curadoria qualitativa (alocação de capital histórica, M&A, execução), como as teses |
| 7 | Runway de Crescimento | 5% | **Fica nula por definição desta v1** — a própria especificação pediu para começar manual/documentado |
| 8 | Diluição | 5% | Sinal PARCIAL: recompra de ações detectada na DFC (positivo) ou ausência dela (neutro) — **não mede emissão real**, porque não há histórico de número de ações |

Confiança do score: `alta` se ≥70% do peso total veio de componentes com
dado real, `media` se ≥40%, `baixa` abaixo disso. Fórmulas exatas em
`src/lib/compounder/v1.ts` — cada faixa (ex.: ROIC 15% → nota 60) está
documentada no código, versionada, nunca "peso secreto".

## Sensibilidade à queda da Selic (v1)

A especificação pediu para não usar só o setor. Esta v1 combina três
fatores: alavancagem (dívida líquida ÷ patrimônio), intensidade de
reinvestimento (retenção do lucro) e, só depois, o modelo de negócio como
fator adicional (nunca único). **É uma heurística declarada — nunca foi
calibrada contra o histórico real de preço da ação vs. movimentos da
Selic.** Isso está escrito também na tela onde a categoria aparece.

## Decision Engine — o que foi implementado

Conforme pedido: o sistema NÃO compra nada sozinho quando a Selic cai. A
página `/compounders` mostra quantas empresas têm sensibilidade alta/muito
alta na leitura atual e sugere olhar o Focus — é só um dado a mais para
você olhar, nunca uma ação automática. Não fiz a versão "acionada pelo
Focus automaticamente" (detectar tendência consistente de queda ao longo
de semanas) porque isso tocaria o pipeline noturno que já tem uma tarefa
agendada para hoje 20h58 (fiação do motor) — preferi não competir com esse
trabalho já planejado. Fica registrado como próximo passo.

## O que ficou de fora — e por quê (não é esquecimento)

- **Backtest 2015/2018/2020/2022 vs. Ibovespa/CDI/IPCA/S&P500**: exige (a)
  anos de fundamentos e preços que não temos, (b) uma coleta nova de
  S&P500 que não existe. Decisão de infraestrutura e prazo, não de código
  de hoje.
- **Growth Thesis (IA)**: depende de `ANTHROPIC_API_KEY`, já na fila do
  Carlos por outro motivo. Quando a chave existir, este módulo reaproveita
  a mesma disciplina do resto do sistema — IA explica, nunca pontua.
- **Carteira Compounder (modelo)**: decisão de linguagem pendente (ver
  acima, regra 7 + CI). Não implementada até essa decisão.
- **Dashboard de entrada/saída e mudança de Score**: o score é calculado
  NA HORA (como o Radar), sem gravação diária ainda — não existe "ontem"
  para comparar. Vira real quando (e se) o Carlos decidir gravar
  `compounder_score` diariamente, o que também tocaria o pipeline noturno.
- **Gráficos**: os componentes mostram os NÚMEROS usados (não gráfico SVG)
  — a janela de dados ainda é curta demais (poucos trimestres) para um
  gráfico dizer mais do que a tabela já diz.
- **Timeline (quando entrou/saiu do índice)**: mesma razão do dashboard —
  sem snapshot diário gravado, não existe histórico para mostrar ainda.
- **Filtros interativos** (Score > 90, ROIC > 20 etc.): a v1 usa
  ordenação + destaque dos top 3 ("Índice Compounder") na própria tabela,
  em vez de controles de filtro em JavaScript — mesmo padrão visual das
  outras páginas do sistema (Radar, Auditoria), que também são tabelas
  estáticas ordenadas, não paineis interativos.

## Versionamento

`COMPOUNDER_CONFIG.versaoVigente = 1` (`src/lib/compounder/types.ts`).
Mudar peso ou fórmula de um componente = nova versão, nunca editar a v1
por baixo — mesma regra do Carry Engine e do Score setorial.
