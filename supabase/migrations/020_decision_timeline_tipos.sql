-- ============================================================
-- ENCORPEI INVEST — Migração 020 · Foundation v3, Módulo 6: DECISION TIMELINE
-- Decisão arquitetural (documentada): a especificação pede uma "timeline"
-- que registre mudança de tese, mudança macro, novo balanço, novo
-- controlador, mudança técnica, mudança de consenso, mudança de carry,
-- mudança de nota. Isso já existe como mecanismo: `eventos_tese`
-- (migração 004) é imutável desde o dia 1 (INSERT-only, revoke
-- update/delete até para service_role) e já é usada pelo Replay.
-- Criar uma segunda tabela fragmentaria a timeline em duas fontes — pior
-- para auditoria. Esta migração só amplia os tipos de evento aceitos;
-- src/lib/decision-timeline.ts traz os detectores puros (compara
-- antes/depois e decide se o evento existe). O WIRING desses detectores
-- dentro de /api/teses/avaliar fica como pendência documentada do Bloco 1
-- (ver relatório final) — decisão deliberada de não tocar essa rota uma
-- terceira vez no mesmo dia.
--
-- Corte honesto: a especificação também pedia "mudança macro", "novo
-- controlador" e "mudança de consenso" como tipos de evento. Os 3 ficam
-- DE FORA desta migração (não são "peso zero disfarçado" — são ausência
-- documentada): não existe hoje fonte de dado para composição acionária
-- (controlador) nem para consenso de mercado, e Macro é contexto, não
-- evento discreto e comparável por empresa (mesmo corte já feito no
-- Confluence v2, ver src/lib/confluencia.ts). Entram quando tiverem motor
-- real por trás — nunca antes disso.
-- ============================================================

alter table public.eventos_tese drop constraint if exists eventos_tese_tipo_check;
alter table public.eventos_tese add constraint eventos_tese_tipo_check
  check (tipo in (
    'criacao',
    'gatilho_disparado',
    'mudanca_status',
    'revisao',
    'ratificacao',
    'mudanca_confluence',
    'mudanca_carry',
    'mudanca_nota',
    'novo_balanco',
    'mudanca_tecnica'
  ));
