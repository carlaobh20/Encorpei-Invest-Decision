-- ============================================================
-- ENCORPEI INVEST — Migração 005 · 9 teses de QUALIDADE (v1 rascunho)
-- Critério definido pelo Carlos em 31/07/2026: líderes de setor,
-- balanço leve/caixa líquido, retornos altos. Gatilhos calibrados
-- pelos dados oficiais de cada empresa no banco (CVM até 1T26).
-- Cada tese é RASCUNHO do sistema — ratificação do Carlos vira v2.
-- ============================================================

do $$
declare
  t_id uuid;
begin

-- ---------- WEGE3 · WEG ----------
if not exists (select 1 from teses where ticker='WEGE3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('WEGE3', 1, 'valida', 'alta',
'Líder brasileira em motores elétricos e equipamentos de energia, com décadas de execução impecável. Os números contam a história: retorno sobre o capital acima de 30% ao ano, margem líquida na casa de 16% e mais caixa do que dívida. É o tipo de empresa que raramente fica barata — a tese é segurar qualidade e aproveitar quedas de preço que não venham acompanhadas de piora nos números. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'ROIC abaixo de 20%',               'roic',            '<', 0.20, 'negativo'),
    (t_id, 'Margem líquida abaixo de 12%',     'margem_liquida',  '<', 0.12, 'negativo'),
    (t_id, 'Perdeu o caixa líquido',           'divida_liquida',  '>', 0,    'negativo'),
    (t_id, 'Queda de 15% em 30 dias',          'queda_preco_30d', '>', 0.15, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema, critério: qualidade/líder/caixa líquido). ROIC atual ~31%, margem ~16%, caixa líquido de ~R$ 3,7 bi.');
end if;

-- ---------- B3SA3 · B3 ----------
if not exists (select 1 from teses where ticker='B3SA3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('B3SA3', 1, 'valida', 'alta',
'A B3 é a única bolsa de valores do Brasil — um quase-monopólio de infraestrutura financeira. Quase metade de cada real de receita vira lucro (margem líquida ~46%) e o retorno sobre o capital passa de 25% ao ano, com caixa robusto. A tese é ser dona do "pedágio" do mercado de capitais brasileiro: enquanto houver gente negociando ações, a B3 cobra a passagem. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'ROIC abaixo de 15%',               'roic',            '<', 0.15, 'negativo'),
    (t_id, 'Margem líquida abaixo de 30%',     'margem_liquida',  '<', 0.30, 'negativo'),
    (t_id, 'Dívida líquida acima de R$ 5 bi',  'divida_liquida',  '>', 5000000000, 'negativo'),
    (t_id, 'Queda de 15% em 30 dias',          'queda_preco_30d', '>', 0.15, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema). Margem atual ~46%, ROIC ~29%, posição de caixa confortável.');
end if;

-- ---------- ABEV3 · Ambev ----------
if not exists (select 1 from teses where ticker='ABEV3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('ABEV3', 1, 'valida', 'media',
'Líder absoluta em bebidas na América Latina, dona de marcas que o consumidor pede pelo nome. Gera caixa como poucas: R$ 16 bi a mais em caixa do que em dívidas, margem líquida de ~17% e retorno sobre capital acima de 20%. O crescimento é lento — a tese não é explosão, é uma máquina de caixa comprada a preço justo, com o caixa líquido funcionando de colchão. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'ROIC abaixo de 12%',               'roic',            '<', 0.12, 'negativo'),
    (t_id, 'Margem líquida abaixo de 12%',     'margem_liquida',  '<', 0.12, 'negativo'),
    (t_id, 'Perdeu o caixa líquido',           'divida_liquida',  '>', 0,    'negativo'),
    (t_id, 'Queda de 15% em 30 dias',          'queda_preco_30d', '>', 0.15, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema). Margem ~17%, ROIC ~21%, caixa líquido de ~R$ 16,5 bi.');
end if;

-- ---------- TOTS3 · Totvs ----------
if not exists (select 1 from teses where ticker='TOTS3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('TOTS3', 1, 'valida', 'media',
'Líder disparada em software de gestão para empresas no Brasil — o "sistema operacional" de dezenas de milhares de negócios, com receita recorrente e cliente que raramente troca de fornecedor. Margem líquida de ~13% e retorno sobre capital acima do custo. Atenção do rascunho: a empresa passou a carregar alguma dívida em 2026 (movimento de aquisição) — o gatilho de dívida vigia se isso sair do controle. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'ROIC abaixo de 8%',                'roic',            '<', 0.08, 'negativo'),
    (t_id, 'Margem líquida abaixo de 10%',     'margem_liquida',  '<', 0.10, 'negativo'),
    (t_id, 'Dívida líquida acima de R$ 5 bi',  'divida_liquida',  '>', 5000000000, 'negativo'),
    (t_id, 'Queda de 15% em 30 dias',          'queda_preco_30d', '>', 0.15, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema). Margem ~13,5%, ROIC ~10,6%, dívida líquida de R$ 3,4 bi pós-aquisição (vigiada pelo gatilho de R$ 5 bi).');
end if;

-- ---------- LREN3 · Lojas Renner ----------
if not exists (select 1 from teses where ticker='LREN3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('LREN3', 1, 'valida', 'media',
'Maior varejista de moda do Brasil, com marca forte, escala e — raro no varejo — caixa líquido no balanço. Margem líquida de ~8% e retorno sobre capital em recuperação após o ciclo difícil do varejo. A tese é liderança + balanço saudável: quando o varejo aperta, quem tem caixa compra briga; quem tem dívida fecha loja. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'ROIC abaixo de 7%',                'roic',            '<', 0.07, 'negativo'),
    (t_id, 'Margem líquida abaixo de 5%',      'margem_liquida',  '<', 0.05, 'negativo'),
    (t_id, 'Perdeu o caixa líquido',           'divida_liquida',  '>', 0,    'negativo'),
    (t_id, 'Queda de 20% em 30 dias',          'queda_preco_30d', '>', 0.20, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema). Margem ~7,6%, ROIC ~8,6%, caixa líquido de ~R$ 1,5 bi.');
end if;

-- ---------- RADL3 · Raia Drogasil ----------
if not exists (select 1 from teses where ticker='RADL3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('RADL3', 1, 'valida', 'media',
'Líder nacional em farmácias, num setor que cresce com o envelhecimento da população e resiste a crise — remédio não espera a economia melhorar. A margem líquida é fina (perto de 3% no ano), típica de varejo de giro alto, mas o retorno sobre capital supera 15% nos períodos bons. A tese é crescimento previsível de líder em setor defensivo. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'ROIC abaixo de 10%',               'roic',            '<', 0.10, 'negativo'),
    (t_id, 'Margem líquida abaixo de 1,2%',    'margem_liquida',  '<', 0.012, 'negativo'),
    (t_id, 'Dívida líquida acima de R$ 6 bi',  'divida_liquida',  '>', 6000000000, 'negativo'),
    (t_id, 'Queda de 15% em 30 dias',          'queda_preco_30d', '>', 0.15, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema). ROIC ~11%, margem fina típica do setor (~1,5% no tri), dívida controlada (~R$ 3,1 bi, majoritariamente aluguéis).');
end if;

-- ---------- VIVT3 · Vivo (Telefônica Brasil) ----------
if not exists (select 1 from teses where ticker='VIVT3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('VIVT3', 1, 'valida', 'media',
'Líder em telefonia e internet no Brasil, com a maior base de clientes e a melhor rede. Negócio previsível, quase uma concessionária: todo mês a conta chega e o caixa entra. Dívida pequena para o tamanho (R$ 10 bi contra patrimônio de R$ 70 bi) e margem estável. A tese é previsibilidade e dividendos, não crescimento — o gatilho vigia se a margem ou a disciplina de dívida escapar. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'ROIC abaixo de 6%',                'roic',            '<', 0.06, 'negativo'),
    (t_id, 'Margem líquida abaixo de 6%',      'margem_liquida',  '<', 0.06, 'negativo'),
    (t_id, 'Dívida líquida acima de R$ 25 bi', 'divida_liquida',  '>', 25000000000, 'negativo'),
    (t_id, 'Queda de 15% em 30 dias',          'queda_preco_30d', '>', 0.15, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema). Margem ~8%, ROIC ~7,6%, dívida líquida de ~R$ 10,7 bi (baixa para o porte).');
end if;

-- ---------- MULT3 · Multiplan ----------
if not exists (select 1 from teses where ticker='MULT3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('MULT3', 1, 'valida', 'media',
'Dona dos melhores shoppings do país (MorumbiShopping, BarraShopping e afins) — imóveis únicos, impossíveis de replicar, nos endereços mais valiosos. Margem líquida perto de 40%: aluguel de shopping premium é um dos melhores negócios imobiliários que existem. A tese é qualidade de ativo irreplicável com gestão fundadora. A dívida é a régua a vigiar, como em todo negócio imobiliário. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'ROIC abaixo de 9%',                'roic',            '<', 0.09, 'negativo'),
    (t_id, 'Margem líquida abaixo de 30%',     'margem_liquida',  '<', 0.30, 'negativo'),
    (t_id, 'Dívida líquida acima de R$ 7 bi',  'divida_liquida',  '>', 7000000000, 'negativo'),
    (t_id, 'Queda de 15% em 30 dias',          'queda_preco_30d', '>', 0.15, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema). Margem ~38%, ROIC ~11,6%, dívida líquida de ~R$ 4,5 bi.');
end if;

-- ---------- PSSA3 · Porto ----------
if not exists (select 1 from teses where ticker='PSSA3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('PSSA3', 1, 'valida', 'media',
'Líder em seguros de automóvel no Brasil, com marca de confiança construída em décadas e um ecossistema crescente (saúde, banco, serviços). Seguradora boa é uma máquina dupla: ganha no seguro e ganha aplicando o dinheiro dos prêmios enquanto o sinistro não vem. Lucro recorde em 2025 e margem em expansão. Observação técnica do rascunho: por ser seguradora, os indicadores de dívida e ROIC tradicionais não se aplicam — os gatilhos vigiam margem e preço. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'Margem líquida abaixo de 6%',      'margem_liquida',  '<', 0.06, 'negativo'),
    (t_id, 'Queda de 15% em 30 dias',          'queda_preco_30d', '>', 0.15, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema). Margem ~10,7% no 1T26, lucro anual recorde de R$ 3,4 bi em 2025. Métricas de dívida/ROIC não se aplicam a seguradoras.');
end if;

-- ---------- EGIE3 · Engie Brasil ----------
if not exists (select 1 from teses where ticker='EGIE3') then
  insert into teses (ticker, versao, status, confianca, texto) values ('EGIE3', 1, 'valida', 'media',
'Maior geradora privada de energia do Brasil, com contratos longos que garantem receita previsível por anos — energia é o produto que ninguém deixa de comprar. Margem líquida acima de 20% e retorno sobre capital superior ao de quase todas as elétricas. A dívida é alta em valor absoluto (característica do setor, que financia usinas), por isso o gatilho vigia o teto dela com folga calibrada. [Rascunho v1 do sistema — ratifique ou edite para virar v2.]')
  returning id into t_id;
  insert into gatilhos (tese_id, descricao, metrica, operador, valor, direcao) values
    (t_id, 'ROIC abaixo de 8%',                'roic',            '<', 0.08, 'negativo'),
    (t_id, 'Margem líquida abaixo de 15%',     'margem_liquida',  '<', 0.15, 'negativo'),
    (t_id, 'Dívida líquida acima de R$ 30 bi', 'divida_liquida',  '>', 30000000000, 'negativo'),
    (t_id, 'Queda de 15% em 30 dias',          'queda_preco_30d', '>', 0.15, 'positivo');
  insert into eventos_tese (tese_id, tipo, explicacao) values
    (t_id, 'criacao', 'Tese v1 (rascunho do sistema). Margem ~22%, ROIC ~12,5%, dívida líquida de ~R$ 24,7 bi (setor intensivo em capital; teto vigiado em R$ 30 bi).');
end if;

end $$;

select t.ticker, t.status, t.confianca, count(g.id) as gatilhos
from teses t left join gatilhos g on g.tese_id = t.id
group by t.ticker, t.status, t.confianca
order by t.ticker;
