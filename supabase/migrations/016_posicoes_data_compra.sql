-- ENCORPEI — Migração 016: data de referência da posição.
-- Campo OPCIONAL: quando preenchido, permite comparar o resultado da
-- posição com o CDI/Ibovespa acumulados DESDE A COMPRA — sem ele, a
-- comparação por benchmark fica indisponível para aquele papel (nunca
-- estimada). Captura agora para não exigir retrabalho do Carlos depois.

alter table posicoes add column if not exists data_compra date;
-- APLICADA em 03/08/2026 via SQL Editor (Chrome).
