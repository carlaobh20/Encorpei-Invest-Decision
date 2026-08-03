-- ENCORPEI — Migração 019: Encorpei Research Lab (ERL) — Fase 1, arquitetura.
-- APLICADA em 03/08/2026 via SQL Editor (verificado: 8 linhas em erl.cobertura_dados).
--
-- Spec completa do Carlos (19 camadas: Historical Database, Time Machine,
-- Feature Store, Pattern/Predictive/Probability/Evidence Engines, Weight
-- Optimization, Regime Detection, False Positive/Negative, Decision Replay,
-- Research Notebook, Approval, Knowledge Base, Dashboard, Self Improvement).
-- Decisão de fase registrada em roadmap/erl-fase1-v1.md.
--
-- ESTA MIGRAÇÃO constrói só o essencial estrutural da Fase 1:
--   1) schema `erl`, ISOLADO do `public` (produção) — nenhuma tabela de
--      produção é lida ou escrita por aqui, e nenhuma função de produção
--      lê tabela `erl.*` (regra da spec: "nunca compartilhar banco com o
--      Production Engine" — cumprida como isolamento por schema + RLS,
--      não um projeto Supabase novo, para não criar custo/operação extra
--      pro Carlos sem necessidade comprovada).
--   2) erl.hipoteses — Research Notebook (camada 12): toda descoberta,
--      testada ou não, fica registrada aqui, para sempre (nunca DELETE).
--   3) erl.aprovacoes — Research Approval (camada 15): nenhuma hipótese
--      vira mudança de produção sem uma linha aqui com aprovado=true e
--      aprovado_por preenchido À MÃO. Sem isso, PARA — sem exceção.
--   4) erl.cobertura_dados — status real de profundidade histórica por
--      fonte (camada 1, mas como METADADO, não os dados em si) — pra
--      nunca a Fase 2+ "descobrir" um padrão estatístico sobre uma janela
--      de dados curta demais sem que isso fique visível e registrado.
--
-- Deliberadamente NÃO nesta migração: nenhuma tabela de feature store,
-- pattern discovery, ou backtest — essas dependem de profundidade
-- histórica real (ver erl-fase1-v1.md) e viriam com schema prematuro se
-- construídas antes de saber o formato exato dos dados disponíveis.

create schema if not exists erl;

-- ---------- Research Notebook (camada 12) ----------
create table if not exists erl.hipoteses (
  id bigint generated always as identity primary key,
  titulo text not null,
  hipotese text not null,              -- a pergunta/afirmação testável
  metodologia text,                    -- como foi testada
  dados_utilizados text,               -- fontes + período coberto
  resultado jsonb,                     -- métricas: n, período, probabilidade, drawdown médio etc.
  significancia_estatistica text,      -- ex.: "n=214, p<0,05" — nunca omitido se resultado existir
  limitacoes text,
  status text not null default 'em_teste' check (status in ('em_teste', 'validado', 'descartado')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
alter table erl.hipoteses enable row level security;
drop policy if exists "leitura publica erl_hipoteses" on erl.hipoteses;
create policy "leitura publica erl_hipoteses" on erl.hipoteses for select using (true);
-- INSERT/UPDATE só via service_role (sem policy de escrita pro anon/authenticated)
-- espelha o INSERT-only de eventos_tese/decisoes: nunca apagar, status muda, não o registro.
revoke delete on erl.hipoteses from anon, authenticated;

-- ---------- Research Approval (camada 15) ----------
-- Nenhuma sugestão do ERL entra em produção sem uma linha aqui, aprovada
-- à mão. `aprovado is null` = pendente; nunca automatizar esse campo.
create table if not exists erl.aprovacoes (
  id bigint generated always as identity primary key,
  hipotese_id bigint not null references erl.hipoteses(id),
  impacto_esperado text not null,
  resultado_historico text not null,
  risco text not null,
  justificativa text not null,
  aprovado boolean,                    -- null = pendente (default real)
  aprovado_por text,
  aprovado_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table erl.aprovacoes enable row level security;
drop policy if exists "leitura publica erl_aprovacoes" on erl.aprovacoes;
create policy "leitura publica erl_aprovacoes" on erl.aprovacoes for select using (true);
revoke delete on erl.aprovacoes from anon, authenticated;

-- ---------- Cobertura de dados (camada 1, metadado — não os dados) ----------
-- Registro honesto de profundidade histórica real por fonte, mantido à
-- mão/por script enquanto a Fase 1 evolui. Existe pra nenhuma camada
-- futura (Pattern Discovery, Predictive Power) apresentar "82% das vezes"
-- sobre uma janela de dados que ninguém checou se é grande o suficiente.
create table if not exists erl.cobertura_dados (
  fonte text primary key,              -- 'cvm_dfp' | 'cvm_itr' | 'bcb_cdi' | 'bcb_ipca' | 'bcb_selic' | 'precos_brapi' | 'fluxo_institucional' | 'consenso_analistas' | 'controlador'
  desde date,
  ate date,
  status text not null check (status in ('disponivel_gratis', 'gated_por_plano_pago', 'indisponivel', 'nao_pesquisado')),
  observacao text,
  atualizado_em timestamptz not null default now()
);
alter table erl.cobertura_dados enable row level security;
drop policy if exists "leitura publica erl_cobertura" on erl.cobertura_dados;
create policy "leitura publica erl_cobertura" on erl.cobertura_dados for select using (true);

insert into erl.cobertura_dados (fonte, desde, ate, status, observacao) values
  ('cvm_dfp', '2010-01-01', '2026-12-31', 'disponivel_gratis', 'Confirmado 03/08/2026: dados.cvm.gov.br tem DFP de 2010 a 2026, grátis. Backfill atual (tools/backfill_cvm.py) só usa 2024-2025 — expandir é o próximo passo concreto, com validação de formato antes de confiar.'),
  ('cvm_itr', '2011-01-01', '2026-12-31', 'disponivel_gratis', 'Mesma fonte/pipeline do DFP, formato trimestral. Backfill atual só usa 2025-2026.'),
  ('bcb_cdi', null, null, 'disponivel_gratis', 'BCB SGS série 12 — histórico público de décadas. tools/coleta_benchmarks.py hoje só puxa janela recente (rolling), não histórico completo.'),
  ('bcb_ipca', null, null, 'disponivel_gratis', 'BCB SGS série 433 — mesma situação do CDI.'),
  ('precos_brapi', null, null, 'nao_pesquisado', 'brapi.dev suporta parâmetro range (1mo..max) mas a documentação pública não deixa claro o limite do plano atual do Carlos — precisa checar no dashboard da conta brapi ou testar direto.'),
  ('fluxo_institucional', null, null, 'indisponivel', 'Mesma decisão pendente desde PIC 01 (item 15 da fila): precisa de fonte paga (B3/IF.data ou similar). Sem isso, Camada 6 (Factor Research) fica sem o fator Fluxo.'),
  ('consenso_analistas', null, null, 'indisponivel', 'Não há fonte integrada hoje. Camada 6 fica sem o fator Consensus até decidir uma fonte.'),
  ('controlador', null, null, 'nao_pesquisado', 'CVM publica movimentação de valores mobiliários de controladores/administradores (formulário VLMO) via IPE — o coletor de IPE já existente (07h, comunicados_oficiais) pode já tocar nisso; precisa checar se o filtro atual inclui essa categoria.')
on conflict (fonte) do nothing;
