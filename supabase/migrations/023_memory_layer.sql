-- ============================================================
-- ENCORPEI INVEST — Migração 023 · Bloco 2, Sprint 2.3: MEMORY LAYER
-- (camada de coleta/persistência de evidências)
-- ============================================================
--
-- Decisão arquitetural registrada (Conselheiro, decisão do Claude, ratificar
-- se discordar): a spec da Sprint 2.3 pede um "modelo único" de evidência
-- com campos que a tabela `evidencias` (migração 021, Foundation v3.1,
-- Evidence Engine) ainda não tem — subcategoria, título, URL oficial,
-- documento oficial. A tabela 021 e o tipo `Evidencia`/`EvidenciaCategoria`
-- em src/lib/evidence.ts são FOUNDATION CONGELADO (consumidos por
-- cause-effect.ts, evidence-weight.ts, thesis-engine.ts, decision-object.ts,
-- predictive-factor-registry.ts) — esta migração NÃO renomeia, NÃO remove e
-- NÃO altera o significado de nenhuma coluna existente. Só ADICIONA colunas
-- novas, opcionais, usadas exclusivamente pela camada de apresentação/
-- auditoria (nunca lidas pelos motores do Foundation, que continuam
-- lendo só ticker/categoria/origem/data/peso_informativo/confiabilidade/
-- descricao/hash/status — exatamente como já liam).
--
-- categoria continua restrita ao enum já congelado de EvidenciaCategoria
-- (margem/roic/receita/custos/guidance/regulatorio/macro_focus/macro_selic/
-- fluxo/consenso/insider_compra/insider_venda/controlador_venda/outro).
-- `subcategoria` é onde entra a taxonomia mais rica pedida pela spec
-- (Financeiro/Governança/Controlador/Mercado/Macro/Dividendos/Capital/
-- Operacional/Regulatório/Estratégico/Técnico) — é rótulo de exibição,
-- nunca consumido por regra de negócio.

alter table public.evidencias
  add column if not exists subcategoria text,
  add column if not exists titulo text,
  add column if not exists url_oficial text,
  add column if not exists documento_oficial text;

comment on column public.evidencias.subcategoria is
  'Taxonomia de exibição da Sprint 2.3 (Financeiro/Governança/Controlador/Mercado/Macro/Dividendos/Capital/Operacional/Regulatório/Estratégico/Técnico) — rótulo de UI/auditoria, nunca lido pelos motores do Foundation.';
comment on column public.evidencias.titulo is
  'Título curto para exibição (Timeline/Replay/Audit) — descricao continua sendo o campo completo consumido/gerado pelos emissores.';
comment on column public.evidencias.url_oficial is
  'Link para o documento/fonte oficial (ex.: link do protocolo CVM/IPE), quando existir. Nulo é uma resposta honesta, não erro.';
comment on column public.evidencias.documento_oficial is
  'Identificador do documento oficial de origem (ex.: número de protocolo CVM), quando existir.';

-- Deduplicação (spec Sprint 2.3): antes de registrar, verificar
-- hash+ticker+data+origem+categoria. Índice único garante a regra também no
-- banco (defesa em profundidade) — a checagem em código (memory-layer.ts)
-- é a que decide "já existe, pular" sem estourar erro de constraint.
create unique index if not exists evidencias_dedup_idx
  on public.evidencias (ticker, categoria, origem, data, hash);

-- Logs de execução dos emissores (spec Sprint 2.3, seção LOGS) — imutável,
-- mesmo padrão do resto do sistema (nunca apagar, só inserir).
create table if not exists public.evidencias_coleta_log (
  id                bigint generated always as identity primary key,
  coletor           text not null,          -- ex.: 'comunicados_ipe', 'macro_focus', 'resultados_dfp_itr'
  iniciado_em       timestamptz not null,
  concluido_em      timestamptz not null,
  quantidade_novas  int not null,
  quantidade_ignoradas_duplicadas int not null default 0,
  quantidade_erros  int not null default 0,
  detalhes          jsonb,
  criado_em         timestamptz not null default now()
);
revoke delete on public.evidencias_coleta_log from anon, authenticated, service_role;
alter table public.evidencias_coleta_log enable row level security;
drop policy if exists "leitura publica coleta log" on public.evidencias_coleta_log;
create policy "leitura publica coleta log" on public.evidencias_coleta_log for select using (true);

create index if not exists evidencias_coleta_log_coletor_idx
  on public.evidencias_coleta_log (coletor, criado_em desc);
