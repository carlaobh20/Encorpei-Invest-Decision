-- ============================================================
-- ENCORPEI INVEST — Migração 024 · Bloco 2, Sprint 2.10: MARKET SCAN ENGINE
-- (snapshot diário do Decision Object, base do Change Detection)
-- ============================================================
--
-- Decisão arquitetural registrada (Conselheiro, decisão do Claude, ratificar
-- se discordar): a spec de Change Detection pede comparar "ontem vs hoje"
-- para Growth/Portfolio Fit/Convicção/Técnica (e, no futuro, Quality/Carry
-- v2 também neste formato mais rico). NENHUM desses campos do Decision
-- Object (Foundation v4) é persistido diariamente hoje — só existem
-- calculados on-demand quando uma tela carrega. `scores`/`carry_score`
-- (migrações anteriores) gravam o motor V1, não o Decision Object v2.
--
-- Esta migração NÃO altera Foundation/Decision Object/Truth Layer/Memory
-- Layer/Wealth Engine (regra da Sprint 2.10) — só cria um lugar pra
-- GRAVAR, uma vez por dia, os campos do Decision Object já calculados em
-- outro lugar. Mesmo padrão imutável do resto do sistema: um INSERT por
-- ticker por dia, nunca UPDATE/DELETE — histórico completo, sempre.
--
-- BLOQUEIO CONHECIDO (registrado, não escondido): esta migração está
-- ESCRITA mas NÃO APLICADA — mesmo bloqueio de conector Supabase que já
-- represa as migrações 022 e 023 há várias sprints. Até ser aplicada E
-- rodar por pelo menos 2 dias seguidos, toda função de Change Detection
-- que depende dela (`detectarMudancaSnapshotV2`, market-scan-change-
-- detection.ts) devolve `disponivel: false` com o motivo — nunca fabrica
-- uma comparação.

create table if not exists public.decision_snapshot_diario (
  id              bigint generated always as identity primary key,
  ticker          text not null,
  data            date not null,
  confluence      numeric,
  carry           numeric,
  quality         numeric,
  growth          numeric,
  technical       numeric,
  portfolio_fit   numeric,
  conviccao       text,
  criado_em       timestamptz not null default now(),
  unique (ticker, data)
);

revoke update, delete on public.decision_snapshot_diario from anon, authenticated, service_role;

alter table public.decision_snapshot_diario enable row level security;
drop policy if exists "leitura publica temporaria" on public.decision_snapshot_diario;
create policy "leitura publica temporaria" on public.decision_snapshot_diario for select using (true);
-- escrita: nenhuma policy de INSERT pro anon/authenticated => só o servidor (service_role) grava, uma vez por ticker por dia (unique constraint acima impede duplicar).

comment on table public.decision_snapshot_diario is
  'Snapshot diário, insert-only, dos campos do Decision Object (Foundation v4) já resolvidos em outro lugar — nunca recalcula nada aqui. Base do Change Detection (Market Scan Engine, Sprint 2.10) para Growth/Portfolio Fit/Convicção/Técnica, que hoje não têm nenhuma série histórica.';
