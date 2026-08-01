-- 008: nº total de ações por empresa — fonte OFICIAL (CVM, composição
-- de capital do ITR/DFP, coluna QT_ACAO_TOTAL_CAP_INTEGR).
-- Motivo: o market_cap da brapi veio errado para MULT3 e EGIE3 (auditoria
-- de 01/08/2026). O motor passa a calcular valor de mercado = fechamento ×
-- qtd_acoes desta tabela; brapi vira apenas fallback.
-- Gerado automaticamente por tools/debug_dre.py (GitHub Actions).

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
  ('ABEV3', 15763665, '2026-03-31'),
  ('AXIA3', 2915428, '2026-03-31'),
  ('B3SA3', 5046500000, '2026-03-31'),
  ('BBAS3', 5730834040, '2026-03-31'),
  ('BBDC4', 10592012028, '2026-03-31'),
  ('BBSE3', 1941400000, '2026-03-31'),
  ('CPLE3', 2982810591, '2026-03-31'),
  ('CXSE3', 3000000, '2026-03-31'),
  ('CYRE3', 456800, '2026-03-31'),
  ('EGIE3', 1142298836, '2026-03-31'),
  ('EQTL3', 1259235297, '2026-03-31'),
  ('EZTC3', 277359027, '2026-03-31'),
  ('FLRY3', 547191026, '2026-03-31'),
  ('GGBR4', 1992761149, '2026-03-31'),
  ('HAPV3', 502630884, '2026-03-31'),
  ('HYPE3', 704009059, '2026-03-31'),
  ('INTB3', 327611110, '2026-03-31'),
  ('ITUB4', 11026869, '2026-03-31'),
  ('KLBN11', 6241478850, '2026-03-31'),
  ('LREN3', 1006845, '2026-03-31'),
  ('MGLU3', 775945010, '2026-03-31'),
  ('MULT3', 513163701, '2026-03-31'),
  ('PETR4', 12888732761, '2026-03-31'),
  ('PRIO3', 872495263, '2026-03-31'),
  ('PSSA3', 646586060, '2026-03-31'),
  ('RADL3', 1752367344, '2026-03-31'),
  ('RDOR3', 2289292590, '2026-03-31'),
  ('RENT3', 1124259345, '2026-03-31'),
  ('SBSP3', 704906807, '2026-03-31'),
  ('SLCE3', 498745930, '2026-03-31'),
  ('SUZB3', 1264117615, '2026-03-31'),
  ('TAEE11', 1033497, '2026-03-31'),
  ('TIMS3', 2392125889, '2026-03-31'),
  ('TOTS3', 599401581, '2026-03-31'),
  ('UGPA3', 1115849873, '2026-03-31'),
  ('VALE3', 4262534, '2026-03-31'),
  ('VBBR3', 1198000, '2026-03-31'),
  ('VIVT3', 3226546622, '2026-03-31'),
  ('WEGE3', 4197317998, '2026-06-30')
on conflict (ticker) do update
  set qtd_acoes = excluded.qtd_acoes,
      data_referencia = excluded.data_referencia,
      fonte = 'cvm_composicao_capital',
      atualizado_em = now();
