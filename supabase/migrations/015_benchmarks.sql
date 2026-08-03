-- ENCORPEI — Migração 015 (DDL): benchmarks_diarios (CDI/IPCA/Ibovespa).
-- Seed histórico de CDI/IPCA entra pela coleta automática (GitHub Actions,
-- tools/coleta_benchmarks.py — este arquivo é regravado com o seed no
-- primeiro run bem-sucedido, mesmo padrão da 012). Ibovespa é sincronizado
-- direto pela rota de coleta diária (brapi), sem passar por aqui.
-- APLICADA em 03/08/2026 via SQL Editor (Chrome).

create table if not exists benchmarks_diarios (
  id bigint generated always as identity primary key,
  indicador text not null,           -- 'CDI' | 'IPCA' | 'IBOVESPA'
  data date not null,
  valor numeric not null,            -- CDI: % a.d. · IPCA: % no mês · IBOVESPA: pontos de fechamento
  fonte text not null default 'bcb_sgs',
  coletado_em timestamptz not null default now(),
  unique (indicador, data)
);
alter table benchmarks_diarios enable row level security;
drop policy if exists "leitura publica benchmarks" on benchmarks_diarios;
create policy "leitura publica benchmarks" on benchmarks_diarios for select using (true);
