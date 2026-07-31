-- ============================================================
-- ENCORPEI INVEST — Migração 006 · Fase 3: DECISION ENGINE v1
-- Fundação: quem pontua são REGRAS VERSIONADAS nesta tabela — a IA
-- nunca dá nota. Mudou peso ou faixa = nova versão, a antiga fica.
-- Histórico de scores é imutável (INSERT-only).
-- ============================================================

-- market cap passa a ser coletado junto com o preço (para Valuation)
alter table public.precos_diarios add column if not exists market_cap numeric;

-- ---------- VERSÕES DO ALGORITMO ----------
create table if not exists public.versao_algoritmo (
  versao      int primary key,
  descricao   text not null,
  pesos       jsonb not null,     -- {"qualidade":0.4,"valuation":0.3,"risco":0.3}
  regras      jsonb not null,     -- faixas de pontuação, legíveis
  criado_em   timestamptz not null default now()
);

-- ---------- SCORES DIÁRIOS (imutável) ----------
create table if not exists public.scores (
  ticker        text not null references public.empresas(ticker),
  data          date not null,
  versao        int not null references public.versao_algoritmo(versao),
  qualidade     numeric,
  valuation     numeric,
  risco         numeric,
  score_final   numeric not null,
  confianca     text not null check (confianca in ('alta','media','baixa')),
  decomposicao  jsonb not null,   -- cada regra aplicada: métrica, valor, pontos, faixa
  criado_em     timestamptz not null default now(),
  primary key (ticker, data, versao)
);

revoke update, delete on public.scores from anon, authenticated, service_role;
revoke update, delete on public.versao_algoritmo from anon, authenticated, service_role;

alter table public.versao_algoritmo enable row level security;
alter table public.scores           enable row level security;
drop policy if exists "leitura publica" on public.versao_algoritmo;
drop policy if exists "leitura publica" on public.scores;
create policy "leitura publica" on public.versao_algoritmo for select using (true);
create policy "leitura publica" on public.scores           for select using (true);

-- ---------- ALGORITMO v1 ----------
insert into public.versao_algoritmo (versao, descricao, pesos, regras) values
(1,
 'v1 — três componentes explicáveis. Qualidade: ROIC + margem líquida + solidez do balanço. Valuation: rendimento do lucro (lucro dos últimos 12 meses ÷ valor de mercado). Risco: alavancagem + estabilidade das margens. Pesos renormalizados quando falta componente (ex.: valuation exige market cap, coletado a partir de 01/08/2026).',
 '{"qualidade": 0.4, "valuation": 0.3, "risco": 0.3}',
 '{
   "roic":       [{"min":0.20,"pts":"100"},{"min":0.12,"pts":"60-100"},{"min":0.08,"pts":"40-60"},{"min":null,"pts":"0-40"}],
   "margem":     [{"min":0.20,"pts":"100"},{"min":0.10,"pts":"60-100"},{"min":0.03,"pts":"30-60"},{"min":null,"pts":"0-30"}],
   "balanco":    [{"regra":"caixa líquido = 100; dívida/patrimônio até 0,5 = 70; até 1 = 50; até 2 = 30; acima = 10"}],
   "valuation":  [{"regra":"rendimento do lucro (LTM/valor de mercado): ≥12% = 100; 8-12% = 70-100; 5-8% = 40-70; 0-5% = 0-40; prejuízo = 10"}],
   "estabilidade":[{"regra":"desvio-padrão das margens trimestrais: até 2pp = 100; até 5pp = 70; até 10pp = 40; acima = 20"}]
 }')
on conflict (versao) do nothing;
