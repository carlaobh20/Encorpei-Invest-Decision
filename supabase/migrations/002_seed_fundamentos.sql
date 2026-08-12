-- ENCORPEI INVEST — Migração 002: fundamentos (dados abertos CVM)
-- Gerado automaticamente pelo GitHub Actions em 2026-08-12

-- Correções de universo (idempotentes):
insert into public.empresas (ticker, nome, setor) values
  ('AXIA3', 'Axia Energia (ex-Eletrobras)', 'Energia Elétrica'),
  ('CPLE3', 'Copel', 'Energia Elétrica')
on conflict (ticker) do nothing;
update public.empresas set ativo = false where ticker in ('ELET3','CPLE6');

insert into public.fundamentos
  (ticker, competencia, receita_liquida, lucro_liquido, margem_bruta,
   margem_liquida, roic, divida_liquida, caixa, patrimonio_liquido, fonte)
values

on conflict (ticker, competencia, fonte) do update set
  receita_liquida = excluded.receita_liquida,
  lucro_liquido = excluded.lucro_liquido,
  margem_bruta = excluded.margem_bruta,
  margem_liquida = excluded.margem_liquida,
  roic = excluded.roic,
  divida_liquida = excluded.divida_liquida,
  caixa = excluded.caixa,
  patrimonio_liquido = excluded.patrimonio_liquido,
  coletado_em = now();
