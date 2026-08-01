-- ============================================================
-- ENCORPEI INVEST — Migração 007 · Fase 5: DIÁRIO DE DECISÃO
-- Cada decisão do investidor fica registrada com a FOTO do que o
-- sistema dizia no momento (nota, status da tese, preço). Imutável:
-- decisão não se edita — se registra outra. É o que permitirá medir,
-- daqui a meses, se o sistema melhora as decisões (gate da Fase 5).
-- ============================================================

create table if not exists public.decisoes (
  id             bigint generated always as identity primary key,
  ticker         text not null references public.empresas(ticker),
  decisao        text not null check (decisao in
                 ('comprei','vendi','aumentei','reduzi','mantive','observei')),
  justificativa  text not null,
  contexto       jsonb,          -- foto: score, status da tese, preço no momento
  user_id        uuid,           -- Fase 4/Auth: not null
  criado_em      timestamptz not null default now()
);

revoke update, delete on public.decisoes from anon, authenticated, service_role;

alter table public.decisoes enable row level security;
drop policy if exists "leitura publica temporaria" on public.decisoes;
create policy "leitura publica temporaria" on public.decisoes for select using (true);
-- escrita: nenhuma policy => só o servidor (rota protegida pela chave)
