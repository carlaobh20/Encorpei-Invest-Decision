# Instruções para o Claude Code — Encorpei Invest

## O que é este projeto

Sistema pessoal de apoio à decisão de investimentos (ações BR). Centro do
sistema: a **Tese Viva** (tese por empresa, com gatilhos, versionada). O dono
do projeto (Carlos) **não é programador**: explique mudanças em português
claro, com passos literais, e nunca assuma conhecimento de terminal.

## Regras de fundação — NUNCA violar

1. **Multiusuário desde o dia 1**: toda tabela de dados de usuário tem
   `user_id` e RLS ligado no Supabase. Dados de mercado (preços, fundamentos)
   são globais, sem `user_id`.
2. **Eventos imutáveis**: `eventos_tese` e histórico de scores só recebem
   INSERT. Nunca UPDATE/DELETE nessas tabelas.
3. **Versionamento**: alterar uma tese ou pesos de score cria NOVA versão;
   a anterior é preservada.
4. **Dados brutos preservados**: gravar a resposta original da fonte (CVM,
   brapi) antes de tratar.
5. **Proveniência**: todo dado carrega fonte e data de coleta.
6. **Regras decidem, IA explica**: scores vêm de funções puras e regras
   versionadas no banco. A API do Claude só redige/explica — nunca pontua.
7. **Linguagem neutra na interface**: "força da tese", "tese válida/quebrada".
   Proibido "compre", "venda", "recomendamos".

## Stack e convenções

- Next.js App Router + TypeScript + Tailwind, código em `src/`
- Supabase via `src/lib/supabase.ts` (chaves em `.env.local`, nunca commitadas)
- Commits pequenos e descritivos em português; push na `main` dispara deploy
  na Vercel
- Antes de qualquer push: `npm run build` precisa passar limpo

## Roadmap

Fases e gates estão no README e no projeto "Encorpei Invest" no Claude.
Não iniciar uma fase sem o gate da anterior cumprido.
