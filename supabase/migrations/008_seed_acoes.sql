-- ENCORPEI INVEST — Migração 008: nº total de ações (fonte OFICIAL:
-- CVM, composicao_capital do ITR/DFP). Usado pelo motor para calcular o
-- valor de mercado (fechamento × qtd_acoes); brapi é apenas fallback.
-- Escala normalizada por lucro/ação (empresas informam ora em unidades,
-- ora em milhares). Gerado automaticamente pelo GitHub Actions em 2026-08-21.

create table if not exists acoes_totais (
  ticker text primary key references empresas(ticker),
  qtd_acoes numeric not null check (qtd_acoes > 0),
  data_referencia date not null,
  fonte text not null default 'cvm_composicao_capital',
  atualizado_em timestamptz not null default now()
);
alter table acoes_totais enable row level security;
drop policy if exists "leitura publica acoes" on acoes_totais;
create policy "leitura publica acoes" on acoes_totais for select using (true);

insert into acoes_totais (ticker, qtd_acoes, data_referencia) values
  ('ABEV3', 15763665000, '2026-06-30'),
  ('AXIA3', 2943220000, '2026-06-30'),
  ('B3SA3', 5046500000, '2026-06-30'),
  ('BBAS3', 5730834040, '2026-06-30'),
  ('BBDC4', 10592012028, '2026-06-30'),
  ('BBSE3', 1941400000, '2026-06-30'),
  ('CPLE3', 2982810591, '2026-06-30'),
  ('CXSE3', 3000000000, '2026-06-30'),
  ('CYRE3', 453446000, '2026-06-30'),
  ('EGIE3', 1142298836, '2026-06-30'),
  ('EQTL3', 1259387047, '2026-06-30'),
  ('EZTC3', 277359027, '2026-06-30'),
  ('FLRY3', 547191026, '2026-06-30'),
  ('GGBR4', 1985156149, '2026-06-30'),
  ('HAPV3', 502630884, '2026-06-30'),
  ('HYPE3', 704009059, '2026-06-30'),
  ('INTB3', 327611110, '2026-06-30'),
  ('ITUB4', 11026869000, '2026-06-30'),
  ('KLBN11', 6241478850, '2026-06-30'),
  ('LREN3', 1006845000, '2026-06-30'),
  ('MGLU3', 775945010, '2026-06-30'),
  ('MULT3', 513163701, '2026-06-30'),
  ('PETR4', 12888732761, '2026-06-30'),
  ('PRIO3', 872495263, '2026-06-30'),
  ('PSSA3', 646586060, '2026-06-30'),
  ('RADL3', 1752367344, '2026-06-30'),
  ('RDOR3', 2240292590, '2026-06-30'),
  ('RENT3', 1124259345, '2026-06-30'),
  ('SBSP3', 3524534026, '2026-06-30'),
  ('SLCE3', 498745930, '2026-06-30'),
  ('SMTO3', 332435391, '2026-06-30'),
  ('SUZB3', 1264117615, '2026-06-30'),
  ('TAEE11', 1033497000, '2026-06-30'),
  ('TIMS3', 2392125889, '2026-06-30'),
  ('TOTS3', 599401581, '2026-06-30'),
  ('UGPA3', 1115849873, '2026-06-30'),
  ('VALE3', 4255763000, '2026-06-30'),
  ('VBBR3', 1198563000, '2026-06-30'),
  ('VIVT3', 3226546622, '2026-06-30'),
  ('WEGE3', 4197317998, '2026-06-30')
on conflict (ticker) do update
  set qtd_acoes = excluded.qtd_acoes,
      data_referencia = excluded.data_referencia,
      fonte = 'cvm_composicao_capital',
      atualizado_em = now();
