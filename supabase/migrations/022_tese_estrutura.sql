-- ============================================================
-- ENCORPEI INVEST — Migração 022 · Foundation v4, Módulo 1: THESIS ENGINE
-- Decisão arquitetural (documentada): a tabela `teses` (migração 004) já é
-- versionada (`versao`, nunca sobrescrita) e já tem `status`. Esta migração
-- NÃO recria essas colunas — só adiciona a estrutura qualitativa que faltava
-- (premissas, evidências, riscos, catalisadores, fatores negativos,
-- objetivos, hipóteses), ligada à tese por FK, no mesmo padrão imutável do
-- resto do sistema: nunca apagar, "retirar" = `ativo = false`.
-- ============================================================

create table if not exists public.tese_estrutura (
  id           bigint generated always as identity primary key,
  tese_id      uuid not null references public.teses(id),
  tipo         text not null check (tipo in
               ('premissa','evidencia','risco','catalisador','fator_negativo','objetivo','hipotese')),
  texto        text not null,
  -- quando tipo = 'evidencia' e existe uma linha correspondente em evidencias (migração 021), linka aqui
  -- em vez de duplicar o texto — nunca obrigatório, premissas/riscos/etc. nem sempre nascem de uma evidência
  evidencia_id bigint references public.evidencias(id),
  ativo        boolean not null default true,
  user_id      uuid,
  criado_em    timestamptz not null default now()
);

revoke delete on public.tese_estrutura from anon, authenticated, service_role;

alter table public.tese_estrutura enable row level security;
drop policy if exists "leitura publica temporaria" on public.tese_estrutura;
create policy "leitura publica temporaria" on public.tese_estrutura for select using (true);
-- escrita: nenhuma policy => só o servidor (service_role) grava/atualiza `ativo`

create index if not exists tese_estrutura_tese_idx on public.tese_estrutura (tese_id, tipo);
