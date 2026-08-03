-- ENCORPEI — Migração 014: CARTEIRA (posições reais do dono).
-- Destrava o Decision Center de verdade: patrimônio, resultado, pesos e
-- alocação só podem ser REAIS com posições registradas. PENDENTE DE APLICAÇÃO.
-- Posições são ESTADO ATUAL (editáveis); o registro imutável de decisões
-- continua sendo o Diário — um não substitui o outro.

create table if not exists posicoes (
  id bigint generated always as identity primary key,
  user_id uuid,                          -- null até o Auth ser ativado
  ticker text not null references empresas(ticker),
  quantidade numeric not null check (quantidade > 0),
  preco_medio numeric not null check (preco_medio > 0),
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  -- nulls not distinct: com user_id ainda NULL (pré-Auth), o mesmo ticker
  -- NÃO pode duplicar — sem isso o upsert criaria posições repetidas
  unique nulls not distinct (ticker, user_id)
);

alter table posicoes enable row level security;
drop policy if exists "leitura publica posicoes" on posicoes;
create policy "leitura publica posicoes" on posicoes for select using (true);
-- escrita só via service_role (server action com PIN/auth, como o Diário)
