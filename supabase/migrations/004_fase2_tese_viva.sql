-- ============================================================
-- ENCORPEI INVEST — Migração 004 · Fase 2: TESE VIVA
-- Fundação aplicada:
--   (2) eventos imutáveis (INSERT-only, inclusive p/ service_role)
--   (3) versionamento: editar tese = nova versão, antiga preservada
--   (1) user_id previsto desde já; RLS ligado. Enquanto não há login
--       (Auth chega na Fase 4), leitura é pública e escrita só do
--       servidor. TODO Fase 4: trocar política p/ auth.uid() = user_id
-- ============================================================

-- ---------- TESES (versionadas; a vigente tem ativa = true) ----------
create table if not exists public.teses (
  id           uuid primary key default gen_random_uuid(),
  ticker       text not null references public.empresas(ticker),
  versao       int  not null default 1,
  ativa        boolean not null default true,
  status       text not null default 'valida'
               check (status in ('valida','em_revisao','quebrada')),
  confianca    text not null default 'media'
               check (confianca in ('alta','media','baixa')),
  texto        text not null,
  user_id      uuid,                          -- dono (Fase 4: not null)
  criado_em    timestamptz not null default now(),
  unique (ticker, versao)
);

-- ---------- GATILHOS (condição executável + legível) ----------
create table if not exists public.gatilhos (
  id           uuid primary key default gen_random_uuid(),
  tese_id      uuid not null references public.teses(id),
  descricao    text not null,                 -- "ROIC abaixo de 12%"
  metrica      text not null,                 -- roic | margem_liquida | divida_liquida | queda_preco_30d
  operador     text not null check (operador in ('<','>','<=','>=')),
  valor        numeric not null,
  direcao      text not null check (direcao in ('positivo','negativo')),
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

-- ---------- EVENTOS (embrião do Replay: imutável, só INSERT) ----------
create table if not exists public.eventos_tese (
  id           bigint generated always as identity primary key,
  tese_id      uuid not null references public.teses(id),
  gatilho_id   uuid references public.gatilhos(id),
  tipo         text not null
               check (tipo in ('criacao','gatilho_disparado','mudanca_status','revisao')),
  detalhe      jsonb,                          -- dados que geraram o evento
  explicacao   text not null,                  -- sempre explicar (DNA)
  criado_em    timestamptz not null default now()
);

-- Imutabilidade de verdade: nem o servidor edita/apaga eventos
revoke update, delete on public.eventos_tese from anon, authenticated, service_role;

-- ---------- SEGURANÇA ----------
alter table public.teses        enable row level security;
alter table public.gatilhos     enable row level security;
alter table public.eventos_tese enable row level security;

drop policy if exists "leitura publica temporaria" on public.teses;
drop policy if exists "leitura publica temporaria" on public.gatilhos;
drop policy if exists "leitura publica temporaria" on public.eventos_tese;
create policy "leitura publica temporaria" on public.teses        for select using (true);
create policy "leitura publica temporaria" on public.gatilhos     for select using (true);
create policy "leitura publica temporaria" on public.eventos_tese for select using (true);
-- escrita: nenhuma policy => só o servidor (service_role) grava

-- ---------- PRIMEIRA TESE VIVA: INTELBRAS (INTB3) ----------
with t as (
  insert into public.teses (ticker, versao, status, confianca, texto)
  values ('INTB3', 1, 'valida', 'alta',
'Empresa de alta qualidade com caixa líquido, ROIC historicamente elevado e execução consistente. ' ||
'A tese é de qualidade a preço razoável: enquanto a Intelbras mantiver retorno sobre capital acima do custo, ' ||
'margens estáveis e disciplina de balanço (caixa líquido), quedas relevantes de preço tendem a ser oportunidade, ' ||
'não sinal de deterioração. A tese quebra se o retorno cair de forma sustentada, a margem comprimir por vários ' ||
'trimestres ou a empresa passar a carregar dívida líquida crescente.')
  on conflict (ticker, versao) do nothing
  returning id
)
insert into public.gatilhos (tese_id, descricao, metrica, operador, valor, direcao)
select t.id, g.descricao, g.metrica, g.operador, g.valor, g.direcao
from t, (values
  ('ROIC anualizado abaixo de 12%',            'roic',            '<', 0.12, 'negativo'),
  ('Margem líquida abaixo de 8%',              'margem_liquida',  '<', 0.08, 'negativo'),
  ('Perdeu o caixa líquido (dívida > 0)',      'divida_liquida',  '>', 0,    'negativo'),
  ('Queda de preço superior a 15% em 30 dias', 'queda_preco_30d', '>', 0.15, 'positivo')
) as g(descricao, metrica, operador, valor, direcao);

insert into public.eventos_tese (tese_id, tipo, explicacao)
select id, 'criacao',
  'Tese criada (v1) com 4 gatilhos: 3 de deterioração (ROIC, margem, dívida) e 1 de oportunidade (queda de preço com fundamentos intactos).'
from public.teses where ticker = 'INTB3' and versao = 1;
