-- ENCORPEI CARRY ENGINE — Migração 009: histórico do carrego estimado.
-- PENDENTE DE APLICAÇÃO (escrita em 03/08/2026; aplicar via SQL Editor).
-- Depois de aplicada, o motor diário passa a gravar o carry de cada empresa
-- junto com as notas — histórico imutável, mesma disciplina de scores.

create table if not exists carry_score (
  id bigint generated always as identity primary key,
  ticker text not null references empresas(ticker),
  data date not null,
  versao int not null,
  metodo text not null,
  carry_real numeric,            -- 0.062 = IPCA + 6,2% a.a. (null = incalculável)
  confianca text not null check (confianca in ('alta','media','baixa')),
  explicacao text not null,      -- nunca mostrar só o número
  fatores jsonb not null default '[]'::jsonb,
  criado_em timestamptz not null default now(),
  unique (ticker, data, versao)
);

alter table carry_score enable row level security;
drop policy if exists "leitura publica carry" on carry_score;
create policy "leitura publica carry" on carry_score for select using (true);

-- histórico IMUTÁVEL: nem o service_role edita o passado
revoke update, delete on carry_score from anon, authenticated, service_role;
