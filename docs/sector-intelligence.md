# Sector Intelligence Engine — Prompt Completo Ajustado ao Encorpei

Versão 1 · 03/08/2026 · Este é o plano EXECUTÁVEL: cada fase diz o que
fazer, com qual dado real, e o que fica gateado até a fonte existir.
Diagnóstico do prompt original: CORRETO — o sistema já denunciava o problema
(confiança rebaixada para financeiras); agora ele vira arquitetura.

## Filosofia adotada (a "última recomendação" do prompt)
O Decision Engine deixa de responder "qual empresa é melhor?" e passa a
responder **"qual é a melhor DENTRO do seu modelo de negócio?"** —
comparação cross-setor continua possível, mas sempre com aviso e métricas
compatíveis. Portfolio Allocation Engine fica para quando existirem
carteiras (posições registradas).

## FASE A — Fundação da classificação ✅ FEITA (03/08)
- `src/lib/setores.ts`: as 40 empresas classificadas por MODELO DE ANÁLISE
  (13 modelos: industrial, banco, seguradora, elétrica/utility, varejo,
  software, saúde, commodities, construção, telecom, shoppings, infra
  financeira, consumo). Metadado determinístico, versionado no git.
- `INDICADORES_EXCLUIDOS` por modelo — regra dura: banco NUNCA tem EBITDA,
  dívida líquida, dívida/patrimônio, ROIC industrial; seguradora idem.
- TESTES no CI garantindo as proibições (o prompt exigiu; está rodando).
- Comparador: AVISO automático quando os modelos diferem + selo do modelo
  em cada card.

## FASE B — Score por setor (nova versao_algoritmo=2) · PRÓXIMA
Regra de ouro: mudar pesos = NOVA versão no banco, a v1 preservada.
- Migração 013: coluna `modelo_analise` em empresas + versao_algoritmo 2
  com pesos POR MODELO (tabela de regras, nunca hardcoded).
- Com dados que JÁ temos por modelo:
  - banco/seguradora/infra-fin: ROE (lucro12m÷PL — já calculável),
    margem, estabilidade, valuation (P/L, P/VP). SEM dívida/ROIC.
  - industrial/consumo/telecom/saúde/varejo: como hoje (ROIC, margens,
    balanço, valuation) + FCF quando a 011 estiver aplicada.
  - commodities: idem industrial + aviso de ciclicidade na explicação
    (margem 12m em commodity é retrato do ciclo, não estrutura).
  - construção: idem + aviso de ciclo longo (POC distorce margens tri).
- Motor diário grava score v2; ranking/Radar mostram "melhor do setor".
- IA/explicações: proibido comparar indicadores incompatíveis (a trava de
  linguagem dos testes ganha casos setoriais).

## FASE C — Indicadores setoriais com FONTE REAL · MAPEADO
O que o prompt pede vs onde existe de verdade:
| Indicador | Fonte real | Status |
|---|---|---|
| ROE, P/VP (bancos) | já temos (CVM) | Fase B |
| Basileia, NIM, inadimplência, PDD, eficiência | **IF.data/Bacen (aberto, gratuito)** — coletor novo estilo Focus | Fase C |
| Combined ratio, sinistralidade (seguros) | SUSEP dados abertos | Fase C |
| NOI, FFO, ABL, vacância (shoppings) | releases da empresa (IPE já coleta os PDFs; extração = IA gateada em API key) | Fase D |
| ARR, churn (software) / ARPU (telecom) / VSO, landbank (construção) | releases (idem) | Fase D |
| RAP, EBITDA regulatório (elétricas) | ANEEL/releases | Fase D |
Regra: indicador sem fonte conectada NÃO aparece — nem como placeholder
numérico. Aparece no doc como gateado.

## FASE D — Teses e Carry por setor
- Estrutura de tese setorial (banco: carteira/inadimplência/NIM;
  industrial: ROIC/reinvestimento; software: recorrência/churn): entra nos
  RASCUNHOS de tese v2 que o Carlos ratifica — tese é opinião estruturada.
- Carry por setor: banco = ROE×retenção + yield (dados já viáveis);
  industrial = escada atual (Floor→Cash via DFC); software = FCF-based.
  Cada um vira um CarryCalculator registrado (arquitetura já plugável).

## Extensibilidade (exigência do prompt: 50+ motores sem tocar o resto)
Novo setor = (1) entrada no MODELO_POR_TICKER, (2) exclusões, (3) pesos na
versao_algoritmo, (4) CarryCalculator opcional, (5) template de tese.
Nada mais muda — comprovado pela arquitetura atual (score/carry plugáveis).

## Vetos com registro
- "Motor v2.3" como selo decorativo de versão inventada — a versão exibida
  será a versao_algoritmo REAL do banco.
- Pesos setoriais "de exemplo" do prompt (ROE 30%, Basileia 25%...) não
  entram como estão: cada peso será calibrado contra os dados das nossas
  empresas e documentado, como foi a calibração da Intelbras.

## Ordem de execução recomendada
1. (amanhã) Aplicar migrações 009-012 pendentes + ligar o que está armado.
2. Fase B completa (score v2 setorial + migração 013) — 1 dia de trabalho.
3. Coletor IF.data/Bacen (bancos) — destrava o motor-banco de verdade.
4. SUSEP (seguradoras) → Fase C completa.
5. Fase D junto com o ciclo de ratificação de teses v2.
