"""
MACRO ENGINE v0 — Relatório Focus (expectativas de mercado, Banco Central).

Fonte OFICIAL e gratuita: API Olinda do BCB (dados abertos), série
ExpectativasMercadoAnuais — a mediana das projeções dos economistas para
IPCA, Selic, PIB e Câmbio, por ano de referência, atualizada toda semana.

Saídas:
- tools/dados/macro_focus.json ................. p/ sincronização pelo app
- supabase/migrations/012_macro_focus.sql ...... tabela + seed (aplicar 1x)
- tools/focus_relatorio.md ..................... diagnóstico auditável

Princípio do Thesis Evolution Engine: macro INFORMA, nunca altera tese
sozinho. Nada de "Macro Score" inventado — mostramos os números oficiais,
a variação e uma explicação por regras.
"""

import json
import os
from datetime import date, timedelta

import requests

BASE = (
    "https://olinda.bcb.gov.br/olinda/servico/Expectativas/versao/v1/odata/"
    "ExpectativasMercadoAnuais"
)
INDICADORES = ["IPCA", "Selic", "PIB Total", "Câmbio"]

rel = ["# Macro Engine v0 — coleta Focus (BCB)", f"Gerado em {date.today()}", ""]


def buscar(indicador: str, desde: str) -> list[dict]:
    """Medianas (base de cálculo 0) desde a data dada, todos os anos-ref."""
    filtro = (
        f"Indicador eq '{indicador}' and Data ge '{desde}' and baseCalculo eq 0"
    )
    url = (
        f"{BASE}?$filter={requests.utils.quote(filtro)}"
        f"&$select=Indicador,Data,DataReferencia,Mediana,numeroRespondentes"
        f"&$orderby=Data desc&$top=200&$format=json"
    )
    r = requests.get(url, timeout=120)
    r.raise_for_status()
    return r.json().get("value", [])


def main() -> None:
    desde = str(date.today() - timedelta(days=120))
    linhas_sql: list[str] = []
    linhas_json: list[dict] = []
    ano_atual = date.today().year
    anos_ref = {str(a) for a in range(ano_atual, ano_atual + 4)}

    for ind in INDICADORES:
        try:
            dados = buscar(ind, desde)
        except Exception as e:  # noqa: BLE001
            rel.append(f"- !! {ind}: falha na API ({type(e).__name__}: {e})")
            continue
        uteis = [d for d in dados if str(d.get("DataReferencia")) in anos_ref]
        rel.append(f"- {ind}: {len(uteis)} observações (pesquisas desde {desde})")
        for d in uteis:
            mediana = d.get("Mediana")
            if mediana is None:
                continue
            linhas_json.append({
                "indicador": ind,
                "data_pesquisa": d["Data"][:10],
                "ano_referencia": int(str(d["DataReferencia"])[:4]),
                "mediana": float(mediana),
                "respondentes": d.get("numeroRespondentes"),
            })
            linhas_sql.append(
                f"  ('{ind}', '{d['Data'][:10]}', {int(str(d['DataReferencia'])[:4])}, "
                f"{float(mediana)}, {d.get('numeroRespondentes') or 'null'})"
            )

    os.makedirs("tools/dados", exist_ok=True)
    with open("tools/dados/macro_focus.json", "w") as f:
        json.dump({"gerado_em": str(date.today()), "focus": linhas_json}, f, ensure_ascii=False)

    if linhas_sql:
        corpo = ",\n".join(sorted(set(linhas_sql)))
        sql = f"""-- ENCORPEI — Migração 012: Relatório Focus (expectativas BCB).
-- Mediana oficial das projeções (IPCA, Selic, PIB, Câmbio) por semana de
-- pesquisa e ano de referência. Fonte: API Olinda/BCB. Gerado {date.today()}.

create table if not exists macro_focus (
  id bigint generated always as identity primary key,
  indicador text not null,
  data_pesquisa date not null,
  ano_referencia int not null,
  mediana numeric not null,
  respondentes int,
  coletado_em timestamptz not null default now(),
  unique (indicador, data_pesquisa, ano_referencia)
);
alter table macro_focus enable row level security;
drop policy if exists "leitura publica focus" on macro_focus;
create policy "leitura publica focus" on macro_focus for select using (true);

insert into macro_focus (indicador, data_pesquisa, ano_referencia, mediana, respondentes) values
{corpo}
on conflict (indicador, data_pesquisa, ano_referencia) do nothing;
"""
        with open("supabase/migrations/012_macro_focus.sql", "w") as f:
            f.write(sql)

    rel.append(f"\n## Resumo: {len(linhas_json)} observações gravadas")
    with open("tools/focus_relatorio.md", "w") as f:
        f.write("\n".join(rel))
    print(f"ok: {len(linhas_json)} observações do Focus")


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001
        import traceback

        rel.append("\n## ERRO NA EXECUÇÃO\n```")
        rel.append(traceback.format_exc())
        rel.append("```")
        with open("tools/focus_relatorio.md", "w") as f:
            f.write("\n".join(rel))
        raise
