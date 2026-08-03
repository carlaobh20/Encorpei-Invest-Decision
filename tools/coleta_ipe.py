"""
MANAGEMENT INTELLIGENCE ENGINE — v0: acervo oficial de comunicações.

Fonte: dataset IPE dos dados abertos da CVM (fatos relevantes, comunicados
ao mercado, apresentações a investidores — os documentos que a própria
companhia protocola). Nunca notícia de terceiros.

Saídas:
- supabase/migrations/010_seed_comunicados.sql (tabela + upsert dos últimos
  ~18 meses para as empresas do universo)
- tools/ipe_relatorio.md (o que veio, o que foi descartado, colunas do zip)

A camada de INTERPRETAÇÃO (IA extrai estratégia/tom/promessas) é a v2 —
destrava com a chave da API do Claude e consome ESTE acervo. Credibilidade
da gestão só nasce depois de trimestres de prometido-vs-entregue medidos.
"""

import io
import time
import unicodedata
import zipfile
from datetime import date

import pandas as pd
import requests

from backfill_cvm import MAPA  # ticker -> regex sobre razão social sem acento

BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC/IPE/DADOS"
ANOS = [2025, 2026]

# categorias que interessam à leitura de gestão (o resto é ruído processual)
CATEGORIAS_UTEIS = [
    "FATO RELEVANTE",
    "COMUNICADO AO MERCADO",
    "APRESENTACOES A INVESTIDORES",  # grafias variam; casamos por prefixo
    "APRESENTACAO",
    "DADOS ECONOMICO-FINANCEIROS",
]

rel = ["# Management Intelligence v0 — coleta IPE (CVM)", f"Gerado em {date.today()}", ""]


def sem_acento(s: str) -> str:
    return (unicodedata.normalize("NFKD", str(s))
            .encode("ascii", "ignore").decode("ascii").upper().strip())


def baixar(url: str) -> zipfile.ZipFile | None:
    for t in range(3):
        try:
            r = requests.get(url, timeout=300)
            if r.status_code != 200:
                rel.append(f"- !! HTTP {r.status_code} em {url}")
                return None
            return zipfile.ZipFile(io.BytesIO(r.content))
        except requests.exceptions.RequestException as e:
            rel.append(f"- tentativa {t+1}/3 falhou ({type(e).__name__}); aguardando 30s")
            time.sleep(30)
    return None


def sql_txt(s: str, limite: int = 500) -> str:
    """escapa aspas simples e limita tamanho (assuntos são curtos; links não)."""
    return str(s).replace("'", "''")[:limite]


def main() -> None:
    linhas: list[str] = []
    dados_json: list[dict] = []
    vistos: set[str] = set()
    por_ticker: dict[str, int] = {}
    descartes_conflito: set[str] = set()

    for ano in ANOS:
        z = baixar(f"{BASE}/ipe_cia_aberta_{ano}.zip")
        if not z:
            continue
        nomes = [n for n in z.namelist() if n.endswith(".csv")]
        rel.append(f"\n## {ano}: arquivos no zip: {nomes}")
        if not nomes:
            continue
        df = pd.read_csv(z.open(nomes[0]), sep=";", encoding="latin-1", dtype=str)
        rel.append(f"Colunas: {', '.join(df.columns)}")

        col_nome = next((c for c in df.columns if "NOME" in c.upper() and "COMPANHIA" in c.upper()), None)
        col_cat = next((c for c in df.columns if c.upper().startswith("CATEGORIA")), None)
        col_assunto = next((c for c in df.columns if "ASSUNTO" in c.upper()), None)
        col_data = next((c for c in df.columns if "DATA_ENTREGA" in c.upper()), None) or \
            next((c for c in df.columns if "DATA_REFER" in c.upper()), None)
        col_link = next((c for c in df.columns if "LINK" in c.upper()), None)
        col_proto = next((c for c in df.columns if "PROTOCOLO" in c.upper()), None)
        if not all([col_nome, col_cat, col_data, col_link]):
            rel.append("!! colunas essenciais não encontradas — ajustar o script")
            continue

        df["NOME_N"] = df[col_nome].map(sem_acento)
        df["CAT_N"] = df[col_cat].map(sem_acento)
        util = df[df["CAT_N"].map(lambda c: any(c.startswith(k) for k in CATEGORIAS_UTEIS))]

        for ticker, padrao in MAPA.items():
            sel = util[util["NOME_N"].str.contains(padrao, regex=True, na=False)]
            if sel.empty:
                continue
            # guardrail: 1 ticker = 1 razão social
            if sel[col_nome].nunique() > 1:
                descartes_conflito.add(f"{ticker}: {sorted(sel[col_nome].unique())}")
                continue
            for _, r in sel.iterrows():
                proto = str(r.get(col_proto, "") or f"{ticker}-{r[col_data]}-{hash(str(r[col_assunto]))%10**8}")
                chave = f"{ticker}|{proto}"
                if chave in vistos:
                    continue
                vistos.add(chave)
                data_e = str(r[col_data])[:10]
                if not data_e or data_e == "nan":
                    continue
                linhas.append(
                    f"  ('{ticker}', '{data_e}', '{sql_txt(r[col_cat], 80)}', "
                    f"'{sql_txt(r.get(col_assunto, '') or '(sem assunto)', 300)}', "
                    f"'{sql_txt(r[col_link], 600)}', '{sql_txt(proto, 80)}')"
                )
                dados_json.append({
                    "ticker": ticker, "data_entrega": data_e,
                    "categoria": str(r[col_cat])[:80],
                    "assunto": str(r.get(col_assunto, '') or '(sem assunto)')[:300],
                    "link": str(r[col_link])[:600], "protocolo": str(proto)[:80],
                })
                por_ticker[ticker] = por_ticker.get(ticker, 0) + 1

    if not linhas:
        rel.append("\n**NADA extraído — ver colunas acima e ajustar.**")
    else:
        corpo = ",\n".join(sorted(linhas))
        sql = f"""-- ENCORPEI — Migração 010: comunicações OFICIAIS (dataset IPE/CVM).
-- Fatos relevantes, comunicados e apresentações protocolados pela própria
-- companhia — matéria-prima do Management Intelligence. Gerado {date.today()}.

create table if not exists comunicados_oficiais (
  id bigint generated always as identity primary key,
  ticker text not null references empresas(ticker),
  data_entrega date not null,
  categoria text not null,
  assunto text not null,
  link text not null,
  protocolo text not null,
  coletado_em timestamptz not null default now(),
  unique (ticker, protocolo)
);
alter table comunicados_oficiais enable row level security;
drop policy if exists "leitura publica comunicados" on comunicados_oficiais;
create policy "leitura publica comunicados" on comunicados_oficiais for select using (true);

insert into comunicados_oficiais (ticker, data_entrega, categoria, assunto, link, protocolo) values
{corpo}
on conflict (ticker, protocolo) do nothing;
"""
        with open("supabase/migrations/010_seed_comunicados.sql", "w") as f:
            f.write(sql)

    import json as _json
    import os as _os
    _os.makedirs("tools/dados", exist_ok=True)
    with open("tools/dados/comunicados.json", "w") as f:
        _json.dump({"gerado_em": str(date.today()), "comunicados": dados_json}, f, ensure_ascii=False)

    rel.append(f"\n## Resumo: {len(linhas)} comunicações · {len(por_ticker)} empresas")
    for t in sorted(por_ticker):
        rel.append(f"- {t}: {por_ticker[t]}")
    if descartes_conflito:
        rel.append("\n## Guardrail (2+ razões sociais — descartados):")
        rel.extend(f"- {d}" for d in sorted(descartes_conflito))
    with open("tools/ipe_relatorio.md", "w") as f:
        f.write("\n".join(rel))
    print(f"ok: {len(linhas)} comunicações de {len(por_ticker)} empresas")


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001 — o traceback vira relatório auditável
        import traceback

        rel.append("\n## ERRO NA EXECUÇÃO\n")
        rel.append("```")
        rel.append(traceback.format_exc())
        rel.append("```")
        with open("tools/ipe_relatorio.md", "w") as f:
            f.write("\n".join(rel))
        raise
