-- ENCORPEI — Migração 017: ratificação de teses.
-- Carlos ratificou as 11 teses do dossiê de 02/08/2026 via chat em 03/08/2026,
-- sem alterações a nenhum texto ou gatilho. Isso NÃO é um status de saúde da
-- tese (valida/em_revisao/quebrada já cobre isso) — é o registro de que a
-- tese passou a ser DELE, conforme o processo descrito no próprio dossiê
-- ("só viram SUAS teses quando você ratificar").
--
-- Campo rápido de consultar na UI (ratificado_em/ratificado_por) + evento
-- na timeline imutável (regra 2 — eventos_tese só recebe INSERT).

alter table public.teses add column if not exists ratificado_em timestamptz;
alter table public.teses add column if not exists ratificado_por text;

alter table public.eventos_tese drop constraint if exists eventos_tese_tipo_check;
alter table public.eventos_tese add constraint eventos_tese_tipo_check
  check (tipo in ('criacao','gatilho_disparado','mudanca_status','revisao','ratificacao'));

-- ---------- ratificação das 11 teses (dossiê 02/08, aprovado no chat 03/08) ----------
update public.teses
set ratificado_em = now(), ratificado_por = 'Carlos (chat, 03/08/2026)'
where versao = 1
  and ticker in ('WEGE3','B3SA3','ABEV3','TOTS3','LREN3','RADL3','VIVT3','MULT3','PSSA3','EGIE3','INTB3')
  and ratificado_em is null;

insert into public.eventos_tese (tese_id, tipo, explicacao)
select id, 'ratificacao',
  'Tese ratificada por Carlos em 03/08/2026, via chat, exatamente como redigida no dossiê de 02/08/2026 — sem ajustes de texto ou gatilhos. A partir daqui é a régua dele, não um rascunho do sistema.'
from public.teses
where versao = 1
  and ticker in ('WEGE3','B3SA3','ABEV3','TOTS3','LREN3','RADL3','VIVT3','MULT3','PSSA3','EGIE3','INTB3')
  and ratificado_em is not null
  and not exists (
    select 1 from public.eventos_tese ev where ev.tese_id = teses.id and ev.tipo = 'ratificacao'
  );
