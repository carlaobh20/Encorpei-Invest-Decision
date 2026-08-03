# Thesis Evolution Engine — Documento de Arquitetura

Versão 1 · 03/08/2026 · Princípio central: **macro informa, nunca decide.**
Nenhum dado macro altera uma tese sozinho; quem muda status é o motor de
gatilhos, e quem muda tese é o Carlos (versionado).

## Módulos e estado real

| Módulo | Estado | Fonte | O que destrava |
|---|---|---|---|
| macro-engine (Focus) | **v0 NO AR** | API Olinda/BCB (oficial, gratuita) — mediana semanal de IPCA, Selic, PIB, Câmbio p/ 4 anos-ref | Card no Decision Center acende com a migração 012 |
| fundamental-engine | **EM PRODUÇÃO** | CVM diária (DRE/BP/DFC) | — |
| valuation-engine | **EM PRODUÇÃO** | nº de ações CVM × preço | — |
| technical-engine | **EM PRODUÇÃO** | preços diários | indicadores acendem com pregões |
| management-engine | v0 no ar (acervo IPE) | CVM/IPE | interpretação: ANTHROPIC_API_KEY |
| thesis-engine | EM PRODUÇÃO | gatilhos + eventos imutáveis | — |
| scenario-engine | GATEADO | — | ver "vetos com registro" |

## Perfis de sensibilidade macro (a fazer, com o Carlos)
São OPINIÃO ESTRUTURADA, não cálculo: "WEG: dólar alta, Selic baixa…".
Caminho: eu rascunho por empresa (como fiz com as teses), Carlos ratifica,
vira metadado versionado da tese (migração futura). A interface mostrará
"perfil qualitativo ratificado em DD/MM" — nunca fingirá ser medido.

## Comparações do Focus (regra, não IA)
Semana atual vs anterior / 30d / 90d / 1 ano — tudo derivável do histórico
que a tabela macro_focus acumula (a API entrega ~4 meses retroativos; o
histórico próprio cresce a cada segunda-feira).

## Vetos com registro (até existir base honesta)
- **Macro Score 0-100**: transformar 4 medianas em uma nota exige pesos
  arbitrários. Mostramos números + variação + frase por regra.
- **Cenários recalculando o Carry por empresa** e **Market Digital Twin**:
  exigem ELASTICIDADES por empresa (quanto o lucro da WEG muda se o dólar
  sobe 10%?). Sem estimá-las a partir de dados reais (anos de histórico) ou
  declará-las como hipótese qualitativa ratificada, seria número inventado.
  Arquitetura preparada: perfis de sensibilidade + histórico macro + DFC
  são exatamente os insumos que um dia calibram isso.
- **"Catalisadores" automáticos**: entram como campo qualitativo da tese
  (v2 das teses, ratificado), não como saída de algoritmo.

## Alertas de segunda-feira (próxima etapa concreta)
Quando a 012 estiver aplicada + 2 semanas de histórico próprio: o motor de
segunda compara Focus novo vs anterior e registra um EVENTO informativo
neutro (ex.: "Focus reduziu Selic 2026 de 12,5% p/ 12,0%") na timeline —
evento informa, não muda status. A supervisão diária já avisa o Carlos.

## Testes
Coletor auto-diagnosticável (stdout commitado). Regras de exibição são
funções puras; entram na suíte vitest quando a 012 existir e o card tiver
lógica de comparação além do Δ semanal.
