# Encorpei Invest

Sistema operacional de inteligência para investimentos. Não prevê o mercado —
aumenta a qualidade da decisão.

O centro do sistema é a **Tese Viva**: cada empresa tem uma tese estruturada,
com gatilhos positivos e negativos, que evolui automaticamente quando os dados
mudam. Quem pontua são **regras versionadas e auditáveis**; a IA **explica**,
nunca decide (caixa branca por construção).

## Stack

- **Next.js (App Router) + TypeScript + Tailwind** — app web, deploy na Vercel
- **Supabase (Postgres)** — dados, autenticação (RLS em tudo), jobs agendados
- **brapi.dev** — cotações · **Dados abertos da CVM** — demonstrativos oficiais
- **API do Claude** — redação e explicação das teses

## Roadmap

O roadmap completo (fases 0–7, gates de avanço e as 7 decisões de fundação)
vive no projeto "Encorpei Invest" no Claude. Resumo das fases:

| Fase | Entrega | Status |
|---|---|---|
| 0 | Fundação: repo + app + deploy automático | ✅ em conclusão |
| 1 | Pipeline de dados (30–50 ações BR) | — |
| 2 | Tese Viva v1 (gatilhos automáticos) | — |
| 3 | Decision Engine v1 (score explicável) | — |
| 4 | Interface de decisão | — |
| 5 | Uso real + track record | — |
| 6 | Validação de negócio | congelada |
| 7 | Expansão (motores, replay, backtests) | — |

## Fundação — regras inegociáveis (Parte 2.5 do roadmap)

1. Toda tabela de dados de usuário tem `user_id` + RLS ligado, desde o dia 1
2. Logs de eventos são imutáveis (só INSERT)
3. Teses e algoritmos são versionados — nunca sobrescrever
4. Dados brutos das fontes são preservados antes do tratamento
5. Todo número tem proveniência (fonte + data de coleta)
6. Regras decidem, IA explica
7. Linguagem neutra: "força da tese", nunca "compre/venda"

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencher com as chaves do Supabase
npm run dev                  # abre em http://localhost:3000
```

## Deploy

Push na branch `main` → deploy automático na Vercel.
Variáveis de ambiente ficam em Vercel → Settings → Environment Variables.

Projeto pessoal de Carlos. Uso próprio; não constitui recomendação de
investimento.
