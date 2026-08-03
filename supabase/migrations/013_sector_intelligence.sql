-- ENCORPEI — Migração 013: Sector Intelligence (Fase B).
-- 1) Cada empresa carrega seu MODELO DE ANÁLISE (espelho do metadado
--    versionado em src/lib/setores.ts — o código é a fonte da regra; o
--    banco guarda para consultas/joins).
-- 2) versao_algoritmo = 2: score setorial — financeiras (banco, seguradora,
--    infra financeira) pontuam por ROE + margem + estabilidade + valuation,
--    SEM dívida/ROIC industrial; demais modelos mantêm as réguas v1;
--    cíclicas ganham aviso de ciclo. A v1 permanece intacta para sempre.
-- PENDENTE DE APLICAÇÃO.

alter table empresas add column if not exists modelo_analise text;

update empresas set modelo_analise = m.modelo from (values
  ('WEGE3','industrial'),('INTB3','industrial'),('RENT3','industrial'),
  ('B3SA3','infraestrutura_financeira'),
  ('ITUB4','banco'),('BBDC4','banco'),('BBAS3','banco'),
  ('PSSA3','seguradora'),('BBSE3','seguradora'),('CXSE3','seguradora'),
  ('ABEV3','holding_consumo'),('UGPA3','holding_consumo'),('VBBR3','holding_consumo'),
  ('TOTS3','software'),
  ('LREN3','varejo'),('MGLU3','varejo'),('RADL3','varejo'),
  ('FLRY3','saude'),('HAPV3','saude'),('RDOR3','saude'),('HYPE3','saude'),
  ('EGIE3','eletrica_utility'),('CPLE3','eletrica_utility'),('AXIA3','eletrica_utility'),
  ('EQTL3','eletrica_utility'),('TAEE11','eletrica_utility'),('SBSP3','eletrica_utility'),
  ('VALE3','commodities'),('PETR4','commodities'),('PRIO3','commodities'),
  ('GGBR4','commodities'),('SUZB3','commodities'),('KLBN11','commodities'),
  ('SLCE3','commodities'),('SMTO3','commodities'),
  ('CYRE3','construcao'),('EZTC3','construcao'),
  ('MULT3','shopping_imobiliario'),
  ('VIVT3','telecom'),('TIMS3','telecom')
) as m(ticker, modelo) where empresas.ticker = m.ticker;

insert into versao_algoritmo (versao, descricao, pesos, regras)
values (
  2,
  'Score setorial (Sector Intelligence Fase B): financeiras pontuam por ROE (bandas 8%/14%/20%), margem, estabilidade e valuation — sem dívida/ROIC industrial (proibidos e testados no CI); cíclicas carregam aviso de ciclo; demais modelos mantêm as réguas da v1. Pesos financeiras: qualidade 45% · valuation 30% · risco 25%.',
  '{"financeiras": {"qualidade": 0.45, "valuation": 0.30, "risco": 0.25}, "demais": {"qualidade": 0.4, "valuation": 0.3, "risco": 0.3}}'::jsonb,
  '{"roe_bandas": {"teto": 0.20, "meio": 0.14, "piso": 0.08}, "proibidos": {"banco": ["roic","divida_liquida","alavancagem","ebitda","liquidez_corrente"], "seguradora": ["roic","divida_liquida","alavancagem","ebitda"]}, "avisos_ciclo": ["commodities","construcao"]}'::jsonb
)
on conflict (versao) do nothing;
