-- ENCORPEI — Migração 011: fluxo de caixa (DFC consolidada da CVM).
-- Destrava os níveis 2-4 do Carry Engine (Growth, Cash, Allocation):
-- caixa operacional, capex, dividendos+JCP pagos e recompras — lidos dos
-- MESMOS zips oficiais do backfill diário. APLICADA em 03/08/2026 via SQL Editor (012: DDL aplicado; seed via coleta).
-- Nota: ITR de DFC é ACUMULADO no ano (jan→fim do trimestre); a coluna
-- inicio + dias preservam o período exato para quem consome.

create table if not exists fluxo_caixa (
  id bigint generated always as identity primary key,
  ticker text not null references empresas(ticker),
  competencia date not null,
  fonte text not null,               -- cvm_dfp | cvm_itr
  inicio date not null,
  dias int,
  tipo text,
  caixa_operacional numeric,         -- 6.01
  fluxo_investimento numeric,        -- 6.02 (inclui M&A/aplicações)
  capex numeric,                     -- linhas imobilizado/intangível do 6.02
  dividendos_jcp numeric,            -- pagos (6.03)
  recompras numeric,                 -- ações em tesouraria (6.03)
  coletado_em timestamptz not null default now(),
  unique (ticker, competencia, fonte, inicio)
);
alter table fluxo_caixa enable row level security;
drop policy if exists "leitura publica fluxo" on fluxo_caixa;
create policy "leitura publica fluxo" on fluxo_caixa for select using (true);
