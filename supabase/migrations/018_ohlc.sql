-- ENCORPEI — Migração 018: abertura/máxima/mínima em precos_diarios.
-- A brapi já devolve open/high/low em toda resposta (confirmado no payload
-- bruto salvo em dados_brutos) — só não estávamos gravando. Sem isso não
-- dá para calcular ATR nem Bollinger de verdade (só com o fechamento).
-- Colunas OPCIONAIS e aditivas: nada existente quebra. Backfill do
-- histórico já coletado entra via UPDATE lendo o próprio dados_brutos
-- (nunca dado novo inventado — é o mesmo payload que já guardávamos).

alter table public.precos_diarios add column if not exists abertura numeric(14,4);
alter table public.precos_diarios add column if not exists maxima numeric(14,4);
alter table public.precos_diarios add column if not exists minima numeric(14,4);

-- Backfill do histórico intraday já coletado (brapi_historico e brapi):
-- lê o array historicalDataPrice de cada payload salvo em dados_brutos e
-- casa por (ticker, data) com o que já está em precos_diarios.
with candidatos as (
  select
    db.referencia as ticker,
    (h->>'date')::bigint as epoch_s,
    (h->>'open')::numeric as abertura,
    (h->>'high')::numeric as maxima,
    (h->>'low')::numeric as minima
  from public.dados_brutos db,
       jsonb_array_elements(db.payload->'results'->0->'historicalDataPrice') h
  where db.fonte = 'brapi'
),
normalizados as (
  select
    ticker,
    -- mesmo ajuste de fuso usado em dataPregaoSaoPaulo(): UTC-3
    (to_timestamp(epoch_s) - interval '3 hours')::date as data,
    abertura, maxima, minima,
    row_number() over (partition by ticker, (to_timestamp(epoch_s) - interval '3 hours')::date order by epoch_s desc) as rn
  from candidatos
)
update public.precos_diarios p
set abertura = n.abertura, maxima = n.maxima, minima = n.minima
from normalizados n
where n.rn = 1
  and p.ticker = n.ticker
  and p.data = n.data
  and p.abertura is null;
