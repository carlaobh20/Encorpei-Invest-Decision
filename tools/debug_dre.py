"""
Investigação: composição de capital na CVM (nº total de ações por empresa).

Motivo (auditoria de 01/08/2026): o valor de mercado da brapi está errado
para pelo menos 2 tickers — MULT3 (303 mi de ações implícitas vs 513 mi
reais) e EGIE3 (1.425 mi vs 1.142 mi reais). Como o Valuation da nota usa
market_cap, precisamos de fonte oficial: o zip ITR/DFP da CVM inclui o
arquivo *composicao_capital*.csv com a quantidade de ações integralizadas.

Saídas:
- tools/debug_dre.md ................ relatório da investigação
- supabase/migrations/008_seed_acoes.sql ... seed oficial (se o arquivo existir)
"""

import io
import time
import unicodedata
import zipfile

import pandas as pd
import requests

from backfill_cvm import MAPA  # ticker -> regex sobre DENOM_CIA (sem acento)

BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC"
saida = ["# Debug — composição de capital (nº de ações) na CVM", ""]


def sem_acento(s):
    return (unicodedata.normalize("NFKD", str(s))
            .encode("ascii", "ignore").decode("ascii").upper().strip())


def baixar(url):
    for t in range(3):
        try:
            r = requests.get(url, timeout=300)
            r.raise_for_status()
            return zipfile.ZipFile(io.BytesIO(r.content))
        except requests.exceptions.RequestException:
            time.sleep(30)
    raise RuntimeError(f"download falhou: {url}")


def achar_composicao(z, rotulo):
    nomes = sorted(z.namelist())
    saida.append(f"\n## Arquivos dentro de {rotulo}\n")
    for n in nomes:
        saida.append(f"- {n}")
    alvo = [n for n in nomes if "composicao_capital" in n.lower()]
    return alvo[0] if alvo else None


def extrair(z, nome_csv, rotulo):
    df = pd.read_csv(z.open(nome_csv), sep=";", encoding="latin-1", dtype=str)
    saida.append(f"\n## Colunas de {nome_csv} ({rotulo})\n")
    saida.append(", ".join(df.columns))
    df["DENOM_N"] = df["DENOM_CIA"].map(sem_acento)

    linhas = {}
    for ticker, padrao in MAPA.items():
        sel = df[df["DENOM_N"].str.contains(padrao, regex=True, na=False)]
        if sel.empty:
            continue
        razoes = sorted(sel["DENOM_CIA"].unique())
        if len(razoes) > 1:
            saida.append(f"\n**{ticker}: {len(razoes)} razões sociais "
                         f"({'; '.join(razoes)}) — descartado (guardrail)**")
            continue
        # última referência, maior versão
        orden = [c for c in ["DT_REFER", "VERSAO"] if c in sel.columns]
        sel = sel.sort_values(orden).tail(1)
        linhas[ticker] = sel.iloc[0]

    saida.append(f"\n## Amostra por ticker ({rotulo}) — linha mais recente\n")
    for ticker, r in sorted(linhas.items()):
        campos = {c: r[c] for c in r.index if c not in ("DENOM_N",)}
        saida.append(f"### {ticker}")
        for c, v in campos.items():
            saida.append(f"- {c}: {v}")
        saida.append("")
    return linhas


def gerar_seed(linhas):
    """Gera a migração 008 se conseguirmos identificar a coluna do total."""
    col_total = None
    exemplo = next(iter(linhas.values()))
    for c in exemplo.index:
        cu = c.upper()
        if "QT_ACAO_TOTAL" in cu and "TESOURARIA" not in cu:
            col_total = c
            break
    if col_total is None:
        saida.append("\n**Não achei coluna de total de ações — seed NÃO gerado. "
                     "Ver colunas acima e ajustar o script.**")
        return False

    valores = []
    for ticker, r in sorted(linhas.items()):
        try:
            qtd = float(str(r[col_total]).replace(",", "."))
        except (TypeError, ValueError):
            continue
        if qtd <= 0:
            continue
        ref = r.get("DT_REFER", "")
        valores.append(f"  ('{ticker}', {qtd:.0f}, '{ref}')")

    if not valores:
        saida.append("\n**Coluna encontrada mas sem valores válidos — seed NÃO gerado.**")
        return False

    corpo_valores = ",\n".join(valores)
    sql = f"""-- 008: nº total de ações por empresa — fonte OFICIAL (CVM, composição
-- de capital do ITR/DFP, coluna {col_total}).
-- Motivo: o market_cap da brapi veio errado para MULT3 e EGIE3 (auditoria
-- de 01/08/2026). O motor passa a calcular valor de mercado = fechamento ×
-- qtd_acoes desta tabela; brapi vira apenas fallback.
-- Gerado automaticamente por tools/debug_dre.py (GitHub Actions).

create table if not exists acoes_totais (
  ticker text primary key references empresas(ticker),
  qtd_acoes numeric not null check (qtd_acoes > 0),
  data_referencia date not null,
  fonte text not null default 'cvm_composicao_capital',
  atualizado_em timestamptz not null default now()
);
alter table acoes_totais enable row level security;
drop policy if exists "leitura publica acoes" on acoes_totais;
create policy "leitura publica acoes" on acoes_totais for select using (true);

insert into acoes_totais (ticker, qtd_acoes, data_referencia) values
{corpo_valores}
on conflict (ticker) do update
  set qtd_acoes = excluded.qtd_acoes,
      data_referencia = excluded.data_referencia,
      fonte = 'cvm_composicao_capital',
      atualizado_em = now();
"""
    with open("supabase/migrations/008_seed_acoes.sql", "w") as f:
        f.write(sql)
    saida.append(f"\n**Seed gerado: supabase/migrations/008_seed_acoes.sql "
                 f"({len(valores)} tickers, coluna {col_total}).**")
    return True


z_itr = baixar(f"{BASE}/ITR/DADOS/itr_cia_aberta_2026.zip")
csv_itr = achar_composicao(z_itr, "itr_cia_aberta_2026.zip")
if csv_itr:
    linhas = extrair(z_itr, csv_itr, "ITR 2026")
    gerar_seed(linhas)
else:
    saida.append("\n**ITR 2026 não tem arquivo composicao_capital — "
                 "ver lista de arquivos acima para achar alternativa.**")

with open("tools/debug_dre.md", "w") as f:
    f.write("\n".join(saida))
print(f"ok: {len(saida)} linhas de relatório")
