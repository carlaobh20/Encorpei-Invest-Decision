"""
BENCHMARKS — CDI e IPCA (Banco Central, séries SGS) para comparar a
Carteira real com referências oficiais. Ibovespa NÃO entra aqui: sem token
da brapi neste ambiente, quem coleta o índice é a própria rota de coleta
diária do app (mesmo lugar que já busca preço das ações).

Fonte: API pública SGS do Banco Central (sem chave, sem custo).
  - série 12  = CDI, taxa % ao dia
  - série 433 = IPCA, variação % no mês

Saída:
- tools/dados/benchmarks_macro.json ... p/ sincronização pelo app
- supabase/migrations/015_benchmarks.sql ... tabela (aplicar 1x)
- tools/benchmarks_relatorio.md ... diagnóstico auditável

Princípio: se a resposta da API vier vazia ou em formato inesperado, o
script REGISTRA a falha e não escreve nada no lugar — nunca inventa um
número de CDI ou IPCA para preencher buraco.
"""

import json
import os
from datetime import date, timedelta

import requests

SERIES = {"CDI": 12, "IPCA": 433}
BASE = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.{codigo}/dados"

rel = ["# Benchmarks — coleta CDI/IPCA (BCB/SGS)", f"Gerado em {date.today()}", ""]


def buscar(codigo: int, dias: int) -> list[dict]:
    desde = (date.today() - timedelta(days=dias)).strftime("%d/%m/%Y")
    ate = date.today().strftime("%d/%m/%Y")
    url = f"{BASE.format(codigo=codigo)}?formato=json&dataInicial={desde}&dataFinal={ate}"
    r = requests.get(url, timeout=60)
    r.raise_for_status()
    dados = r.json()
    if not isinstance(dados, list):
        raise ValueError(f"formato inesperado (esperava lista, veio {type(dados)})")
    return dados


def main() -> None:
    linhas_json: list[dict] = []
    linhas_sql: list[str] = []

    for indicador, codigo in SERIES.items():
        # CDI diário: 400 dias cobre a série do app inteira sem exagero.
        # IPCA mensal: 800 dias garante ~2 anos de meses fechados.
        dias = 400 if indicador == "CDI" else 800
        try:
            dados = buscar(codigo, dias)
        except Exception as e:  # noqa: BLE001
            rel.append(f"- !! {indicador}: falha na API ({type(e).__name__}: {e})")
            continue

        gravados = 0
        for d in dados:
            data_str = d.get("data")
            valor_str = d.get("valor")
            if not data_str or valor_str in (None, ""):
                continue
            try:
                dia, mes, ano = data_str.split("/")
                data_iso = f"{ano}-{mes}-{dia}"
                valor = float(valor_str)
            except (ValueError, AttributeError):
                continue  # linha malformada: pula, nunca chuta
            linhas_json.append({"indicador": indicador, "data": data_iso, "valor": valor})
            linhas_sql.append(f"  ('{indicador}', '{data_iso}', {valor})")
            gravados += 1
        rel.append(f"- {indicador} (SGS {codigo}): {gravados} observações (janela {dias}d)")

    os.makedirs("tools/dados", exist_ok=True)
    with open("tools/dados/benchmarks_macro.json", "w") as f:
        json.dump({"gerado_em": str(date.today()), "benchmarks": linhas_json}, f, ensure_ascii=False)

    if linhas_sql:
        corpo = ",\n".join(sorted(set(linhas_sql)))
        sql = f"""-- ENCORPEI — Migração 015: benchmarks oficiais (CDI, IPCA via BCB/SGS;
-- Ibovespa via brapi, sincronizado pela rota de coleta — não neste seed).
-- Destrava a comparação da Carteira com referências reais. Gerado {date.today()}.

create table if not exists benchmarks_diarios (
  id bigint generated always as identity primary key,
  indicador text not null,           -- 'CDI' | 'IPCA' | 'IBOVESPA'
  data date not null,
  valor numeric not null,            -- CDI: % a.d. · IPCA: % no mês · IBOVESPA: pontos de fechamento
  fonte text not null default 'bcb_sgs',
  coletado_em timestamptz not null default now(),
  unique (indicador, data)
);
alter table benchmarks_diarios enable row level security;
drop policy if exists "leitura publica benchmarks" on benchmarks_diarios;
create policy "leitura publica benchmarks" on benchmarks_diarios for select using (true);

insert into benchmarks_diarios (indicador, data, valor) values
{corpo}
on conflict (indicador, data) do nothing;
"""
        with open("supabase/migrations/015_benchmarks.sql", "w") as f:
            f.write(sql)

    rel.append(f"\n## Resumo: {len(linhas_json)} observações gravadas")
    with open("tools/benchmarks_relatorio.md", "w") as f:
        f.write("\n".join(rel))
    print(f"ok: {len(linhas_json)} observações de benchmarks (CDI/IPCA)")


if __name__ == "__main__":
    try:
        main()
    except Exception:  # noqa: BLE001
        import traceback

        rel.append("\n## ERRO NA EXECUÇÃO\n```")
        rel.append(traceback.format_exc())
        rel.append("```")
        with open("tools/benchmarks_relatorio.md", "w") as f:
            f.write("\n".join(rel))
        raise
