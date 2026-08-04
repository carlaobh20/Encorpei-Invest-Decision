-- ============================================================
-- ENCORPEI INVEST — Migração 021 · Foundation v3.1, Módulo 3: EVIDENCE ENGINE
-- Tabela nova (diferente da decisão de reaproveitar `decisoes`/`eventos_tese`
-- no Bloco 1): evidência é um conceito distinto — fato bruto observado sobre
-- uma empresa (ex.: "CEO comprou ações", "margem aumentou"), independente de
-- existir tese ou decisão registrada. Não cabe em `decisoes` (é do
-- investidor) nem em `eventos_tese` (é da tese). Mesma disciplina de
-- imutabilidade das outras tabelas do sistema: NUNCA apagar — quando uma
-- evidência é substituída ou contestada, o `status` muda, o registro
-- original permanece (mesmo padrão de erl.aprovacoes, migração 019).
-- ============================================================

create table if not exists public.evidencias (
  id                bigint generated always as identity primary key,
  ticker            text not null references public.empresas(ticker),
  categoria         text not null,
  origem            text not null,
  data              date not null,            -- data do fato observado (não da coleta)
  peso_informativo  numeric not null,          -- sinal indica favorável (+) ou desfavorável (-); magnitude = intensidade
  confiabilidade    text not null check (confiabilidade in ('alta','media','baixa')),
  descricao         text not null,
  hash              text not null,             -- SHA-256 do payload bruto (ver src/lib/proveniencia.ts:hashPayload)
  status            text not null default 'ativa' check (status in ('ativa','supersedida','refutada')),
  user_id           uuid,                      -- Fase 4: quem registrou (null = coleta automática)
  criado_em         timestamptz not null default now()
);

-- Nunca apagar — só o status muda (ver comentário acima).
revoke delete on public.evidencias from anon, authenticated, service_role;

alter table public.evidencias enable row level security;
drop policy if exists "leitura publica temporaria" on public.evidencias;
create policy "leitura publica temporaria" on public.evidencias for select using (true);
-- escrita: nenhuma policy => só o servidor (service_role) grava/atualiza status

create index if not exists evidencias_ticker_idx on public.evidencias (ticker, data desc);
