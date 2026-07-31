-- ENCORPEI INVEST — Migração 003
-- (a) links de RI por empresa; (b) correção da view de auditoria
--     (o join precos × fundamentos multiplicava dias_coletados)

alter table public.empresas add column if not exists ri_url text;

update public.empresas set ri_url = v.url
from (values
  ('PETR4',  'https://ri.petrobras.com.br'),
  ('PRIO3',  'https://ri.prio3.com.br'),
  ('VALE3',  'https://ri.vale.com'),
  ('GGBR4',  'https://ri.gerdau.com'),
  ('SUZB3',  'https://ri.suzano.com.br'),
  ('KLBN11', 'https://ri.klabin.com.br'),
  ('ITUB4',  'https://www.itau.com.br/relacoes-com-investidores'),
  ('BBDC4',  'https://www.bradescori.com.br'),
  ('BBAS3',  'https://ri.bb.com.br'),
  ('B3SA3',  'https://ri.b3.com.br'),
  ('BBSE3',  'https://www.bbseguridaderi.com.br'),
  ('CXSE3',  'https://ri.caixaseguridade.com.br'),
  ('PSSA3',  'https://ri.portoseguro.com.br'),
  ('ABEV3',  'https://ri.ambev.com.br'),
  ('WEGE3',  'https://ri.weg.net'),
  ('INTB3',  'https://ri.intelbras.com.br'),
  ('TOTS3',  'https://ri.totvs.com.br'),
  ('RENT3',  'https://ri.localiza.com'),
  ('LREN3',  'https://ri.lojasrenner.com.br'),
  ('MGLU3',  'https://ri.magazineluiza.com.br'),
  ('RADL3',  'https://ri.rd.com.br'),
  ('EQTL3',  'https://ri.equatorialenergia.com.br'),
  ('TAEE11', 'https://ri.taesa.com.br'),
  ('EGIE3',  'https://www.engie.com.br/investidores'),
  ('CPLE6',  'https://ri.copel.com'),
  ('AXIA3',  'https://ri.axia.com.br'),
  ('SBSP3',  'https://ri.sabesp.com.br'),
  ('UGPA3',  'https://ri.ultra.com.br'),
  ('VBBR3',  'https://ri.vibraenergia.com.br'),
  ('HYPE3',  'https://ri.hypera.com.br'),
  ('FLRY3',  'https://ri.fleury.com.br'),
  ('HAPV3',  'https://ri.hapvida.com.br'),
  ('RDOR3',  'https://ri.rededorsaoluiz.com.br'),
  ('VIVT3',  'https://ri.telefonica.com.br'),
  ('TIMS3',  'https://ri.tim.com.br'),
  ('CYRE3',  'https://ri.cyrela.com.br'),
  ('EZTC3',  'https://ri.eztec.com.br'),
  ('MULT3',  'https://ri.multiplan.com.br'),
  ('SLCE3',  'https://ri.slcagricola.com.br'),
  ('SMTO3',  'https://ri.saomartinho.com.br')
) as v(ticker, url)
where public.empresas.ticker = v.ticker;

drop view if exists public.auditoria_dados;
create view public.auditoria_dados
  with (security_invoker = on) as
select
  e.ticker,
  e.nome,
  e.setor,
  e.ri_url,
  (select max(p.data)  from public.precos_diarios p where p.ticker = e.ticker) as ultimo_preco,
  (select count(*)     from public.precos_diarios p where p.ticker = e.ticker) as dias_coletados,
  (select max(f.competencia) from public.fundamentos f where f.ticker = e.ticker) as ultimo_trimestre
from public.empresas e
where e.ativo;
