-- ============================================================
-- ENCORPEI INVEST — Migração 001 · Fase 1: Pipeline de dados
-- Regras de fundação aplicadas:
--   (2) eventos/coletas imutáveis · (4) dados brutos preservados
--   (5) proveniência em todo dado · RLS ligado em tudo
-- Dados de mercado são GLOBAIS (sem user_id). Tabelas de usuário
-- (teses, carteiras) chegam na Fase 2 com user_id + RLS por linha.
-- ============================================================

-- ---------- 1. EMPRESAS (universo investível) ----------
create table if not exists public.empresas (
  ticker      text primary key,
  nome        text not null,
  setor       text,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now()
);

-- ---------- 2. PREÇOS DIÁRIOS ----------
create table if not exists public.precos_diarios (
  ticker       text not null references public.empresas(ticker),
  data         date not null,
  fechamento   numeric(14,4),
  volume       bigint,
  fonte        text not null default 'brapi',          -- proveniência
  coletado_em  timestamptz not null default now(),      -- proveniência
  primary key (ticker, data)
);

-- ---------- 3. FUNDAMENTOS (trimestrais) ----------
create table if not exists public.fundamentos (
  id                  bigint generated always as identity primary key,
  ticker              text not null references public.empresas(ticker),
  competencia         date not null,                    -- fim do trimestre
  receita_liquida     numeric,
  lucro_liquido       numeric,
  margem_bruta        numeric,
  margem_liquida      numeric,
  roic                numeric,
  divida_liquida      numeric,
  caixa               numeric,
  patrimonio_liquido  numeric,
  fonte               text not null,                    -- ex.: 'cvm_dfp', 'cvm_itr'
  coletado_em         timestamptz not null default now(),
  unique (ticker, competencia, fonte)
);

-- ---------- 4. DADOS BRUTOS (resposta original das fontes) ----------
create table if not exists public.dados_brutos (
  id           bigint generated always as identity primary key,
  fonte        text not null,                           -- 'brapi', 'cvm'
  referencia   text not null,                           -- ticker ou arquivo
  payload      jsonb not null,
  coletado_em  timestamptz not null default now()
);

-- ---------- 5. VIEW DE AUDITORIA ----------
create or replace view public.auditoria_dados
  with (security_invoker = on) as
select
  e.ticker,
  e.nome,
  e.setor,
  max(p.data)                as ultimo_preco,
  count(p.data)              as dias_coletados,
  max(f.competencia)         as ultimo_trimestre
from public.empresas e
left join public.precos_diarios p on p.ticker = e.ticker
left join public.fundamentos  f on f.ticker = e.ticker
where e.ativo
group by e.ticker, e.nome, e.setor;

-- ---------- 6. SEGURANÇA (RLS) ----------
alter table public.empresas        enable row level security;
alter table public.precos_diarios  enable row level security;
alter table public.fundamentos     enable row level security;
alter table public.dados_brutos    enable row level security;

-- Leitura pública dos dados de mercado (são globais); escrita SÓ pelo
-- service_role (o servidor), que passa por cima do RLS. Ninguém mais grava.
create policy "leitura publica" on public.empresas       for select using (true);
create policy "leitura publica" on public.precos_diarios for select using (true);
create policy "leitura publica" on public.fundamentos    for select using (true);
-- dados_brutos: nenhuma policy => invisível para clientes; só o servidor lê.

-- ---------- 7. UNIVERSO INICIAL (40 empresas — revisar/ajustar) ----------
insert into public.empresas (ticker, nome, setor) values
  ('PETR4',  'Petrobras',          'Petróleo e Gás'),
  ('PRIO3',  'Prio',               'Petróleo e Gás'),
  ('VALE3',  'Vale',               'Mineração'),
  ('GGBR4',  'Gerdau',             'Siderurgia'),
  ('SUZB3',  'Suzano',             'Papel e Celulose'),
  ('KLBN11', 'Klabin',             'Papel e Celulose'),
  ('ITUB4',  'Itaú Unibanco',      'Bancos'),
  ('BBDC4',  'Bradesco',           'Bancos'),
  ('BBAS3',  'Banco do Brasil',    'Bancos'),
  ('B3SA3',  'B3',                 'Serviços Financeiros'),
  ('BBSE3',  'BB Seguridade',      'Seguros'),
  ('CXSE3',  'Caixa Seguridade',   'Seguros'),
  ('PSSA3',  'Porto',              'Seguros'),
  ('ABEV3',  'Ambev',              'Bebidas'),
  ('WEGE3',  'WEG',                'Bens de Capital'),
  ('INTB3',  'Intelbras',          'Tecnologia'),
  ('TOTS3',  'Totvs',              'Tecnologia'),
  ('RENT3',  'Localiza',           'Aluguel de Veículos'),
  ('LREN3',  'Lojas Renner',       'Varejo'),
  ('MGLU3',  'Magazine Luiza',     'Varejo'),
  ('RADL3',  'Raia Drogasil',      'Varejo Farmacêutico'),
  ('EQTL3',  'Equatorial',         'Energia Elétrica'),
  ('TAEE11', 'Taesa',              'Energia Elétrica'),
  ('EGIE3',  'Engie Brasil',       'Energia Elétrica'),
  ('CPLE6',  'Copel',              'Energia Elétrica'),
  ('ELET3',  'Eletrobras',         'Energia Elétrica'),
  ('SBSP3',  'Sabesp',             'Saneamento'),
  ('UGPA3',  'Ultrapar',           'Distribuição de Combustíveis'),
  ('VBBR3',  'Vibra',              'Distribuição de Combustíveis'),
  ('HYPE3',  'Hypera',             'Farmacêutico'),
  ('FLRY3',  'Fleury',             'Saúde'),
  ('HAPV3',  'Hapvida',            'Saúde'),
  ('RDOR3',  'Rede D''Or',         'Saúde'),
  ('VIVT3',  'Vivo',               'Telecomunicações'),
  ('TIMS3',  'TIM',                'Telecomunicações'),
  ('CYRE3',  'Cyrela',             'Construção Civil'),
  ('EZTC3',  'EZTec',              'Construção Civil'),
  ('MULT3',  'Multiplan',          'Shoppings'),
  ('SLCE3',  'SLC Agrícola',       'Agronegócio'),
  ('SMTO3',  'São Martinho',       'Agronegócio')
on conflict (ticker) do nothing;
