"""
ENCORPEI INVEST — Backfill de fundamentos via dados abertos da CVM.

Roda no GitHub Actions (ver .github/workflows/backfill-cvm.yml).
Baixa DFP (anual) e ITR (trimestral), extrai contas consolidadas das
40 empresas do universo e gera:

  supabase/migrations/002_seed_fundamentos.sql  (dados prontos p/ SQL Editor)
  tools/backfill_relatorio.md                   (o que achou / o que faltou)

Fundação: proveniência em cada linha (fonte cvm_dfp/cvm_itr + data),
nada é inventado — conta ausente vira NULL e aparece no relatório.
"""

import io
import re
import time
import unicodedata
import zipfile
from datetime import date

import pandas as pd
import requests

BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC"
ANOS_DFP = [2024, 2025]
ANOS_ITR = [2025, 2026]

# ticker -> regex sobre a razão social (DENOM_CIA, sem acentos, maiúscula)
MAPA = {
    "PETR4": r"^PETROLEO BRASILEIRO",
    "PRIO3": r"^PRIO S\.?A|PETRO RIO",
    "VALE3": r"^VALE S\.?A",
    "GGBR4": r"^GERDAU S",
    "SUZB3": r"^SUZANO S",
    "KLBN11": r"^KLABIN S",
    "ITUB4": r"ITAU UNIBANCO HOLDING",
    "BBDC4": r"^BCO BRADESCO",
    "BBAS3": r"^BCO BRASIL S",
    "B3SA3": r"^B3 S\.?A",
    "BBSE3": r"BB SEGURIDADE",
    "CXSE3": r"CAIXA SEGURIDADE",
    "PSSA3": r"^PORTO SEGURO S",
    "ABEV3": r"^AMBEV S",
    "WEGE3": r"^WEG S",
    "INTB3": r"INTELBRAS",
    "TOTS3": r"^TOTVS",
    # atenção: existe "LOCALIZA FLEET S.A." (subsidiária) nos arquivos da
    # CVM — o padrão precisa ancorar na controladora listada
    "RENT3": r"^LOCALIZA RENT A CAR",
    "LREN3": r"LOJAS RENNER",
    "MGLU3": r"MAGAZINE LUIZA|MAGAZ LUIZA",
    "RADL3": r"RAIA DROGASIL",
    "EQTL3": r"^EQUATORIAL( ENERGIA)? S",
    "TAEE11": r"TRANSMISSORA ALIAN",
    "EGIE3": r"^ENGIE BRASIL",
    "CPLE3": r"PARANAENSE DE ENERGIA",  # Copel migrou p/ Novo Mercado (CPLE6 extinto em nov/2025)
    # holding apenas — "AXIA ENERGIA NORTE/NORDESTE/SUL S.A." são
    # subsidiárias (ex-Eletronorte/Chesf/Eletrosul) e têm arquivos próprios
    "AXIA3": r"^AXIA ENERGIA S\.?A|^CENTRAIS ELET BRAS|^ELETROBRAS S",
    "SBSP3": r"SANEAMENTO BASICO",
    "UGPA3": r"^ULTRAPAR",
    "VBBR3": r"VIBRA ENERGIA",
    "HYPE3": r"^HYPERA",
    "FLRY3": r"^FLEURY",
    "HAPV3": r"^HAPVIDA",
    "RDOR3": r"REDE D.OR",
    "VIVT3": r"TELEF.{0,2}NICA BRASIL",
    "TIMS3": r"^TIM S\.?A",
    "CYRE3": r"^CYRELA BRAZIL",
    "EZTC3": r"^EZ ?TEC",
    "MULT3": r"^MULTIPLAN",
    "SLCE3": r"SLC AGRICOLA",
    "SMTO3": r"^SAO MARTINHO",
}

log_linhas = []
NOMES_VISTOS: set = set()  # todas as razões sociais vistas (diagnóstico)


def log(msg):
    print(msg, flush=True)
    log_linhas.append(msg)


def sem_acento(s: str) -> str:
    return (
        unicodedata.normalize("NFKD", str(s))
        .encode("ascii", "ignore")
        .decode("ascii")
        .upper()
        .strip()
    )


def ticker_de(denom: str, cache={}) -> str | None:
    d = sem_acento(denom)
    if d in cache:
        return cache[d]
    achado = None
    for t, padrao in MAPA.items():
        if re.search(padrao, d):
            achado = t
            break
    cache[d] = achado
    return achado


def baixar_zip(url: str) -> zipfile.ZipFile | None:
    log(f"Baixando {url}")
    for tentativa in range(1, 4):
        try:
            r = requests.get(url, timeout=300)
            if r.status_code != 200:
                log(f"  !! HTTP {r.status_code} — pulando")
                return None
            return zipfile.ZipFile(io.BytesIO(r.content))
        except requests.exceptions.RequestException as e:
            log(f"  tentativa {tentativa}/3 falhou ({type(e).__name__}); "
                f"aguardando 30s")
            time.sleep(30)
    log("  !! desistiu após 3 tentativas — pulando este arquivo")
    return None


def ler_csv(z: zipfile.ZipFile, sufixo: str) -> pd.DataFrame | None:
    nomes = [n for n in z.namelist() if n.endswith(sufixo)]
    if not nomes:
        log(f"  !! arquivo *{sufixo} não encontrado no zip")
        return None
    df = pd.read_csv(
        z.open(nomes[0]), sep=";", encoding="latin-1", dtype=str
    )
    df["VL_CONTA"] = pd.to_numeric(df["VL_CONTA"], errors="coerce")
    # escala: MIL -> reais
    escala = df.get("ESCALA_MOEDA")
    if escala is not None:
        df.loc[escala == "MIL", "VL_CONTA"] *= 1000
    # só o exercício mais recente informado no documento
    df = df[df["ORDEM_EXERC"].str.upper().str.startswith("Ú", na=False) |
            df["ORDEM_EXERC"].str.upper().str.startswith("U", na=False)]
    # versão mais recente do documento (retificações)
    df["VERSAO"] = pd.to_numeric(df["VERSAO"], errors="coerce")
    idx = df.groupby(["CNPJ_CIA", "DT_REFER"])["VERSAO"].transform("max")
    df = df[df["VERSAO"] == idx]
    NOMES_VISTOS.update(sem_acento(n) for n in df["DENOM_CIA"].unique())
    df["TICKER"] = df["DENOM_CIA"].map(ticker_de)
    df = df[df["TICKER"].notna()].copy()
    # GUARDRAIL (caso Localiza Fleet, 31/07/2026): um ticker jamais pode
    # agregar mais de uma companhia — se o padrão casar 2+ razões sociais,
    # descarta o ticker nesta fonte e denuncia no relatório.
    por_ticker = df.groupby("TICKER")["DENOM_CIA"].nunique()
    conflitos = por_ticker[por_ticker > 1]
    for tk in conflitos.index:
        nomes = sorted(df.loc[df["TICKER"] == tk, "DENOM_CIA"].unique())
        log(f"  !! CONFLITO de mapeamento em {tk}: {nomes} — ticker descartado neste arquivo")
        df = df[df["TICKER"] != tk]
    return df


def valor(df, cds=None, ds_regex=None):
    """Soma VL_CONTA das contas indicadas (por código exato ou por descrição)."""
    sel = pd.Series(False, index=df.index)
    if cds:
        sel |= df["CD_CONTA"].isin(cds)
    if ds_regex is not None:
        sel |= df["DS_CONTA"].map(sem_acento).str.contains(ds_regex, na=False)
    v = df.loc[sel, "VL_CONTA"].dropna()
    return float(v.iloc[0]) if len(v) == 1 else (float(v.sum()) if len(v) else None)


def dias(a, b):
    try:
        return (pd.to_datetime(b) - pd.to_datetime(a)).days
    except Exception:
        return None


def extrair(dre, bpa, bpp, anual: bool, fonte: str, resultados: dict):
    # ITR mistura, no mesmo documento, o trimestre isolado (ex.: abr–jun)
    # e o acumulado (jan–jun). Agrupar TAMBÉM por DT_INI_EXERC separa os
    # dois; o filtro de duração então seleciona só o período desejado.
    alvo_dias = (330, 400) if anual else (80, 100)
    grupos = dre.groupby(["TICKER", "DT_INI_EXERC", "DT_FIM_EXERC"])
    for (ticker, ini, fim), g in grupos:
        d = dias(ini, fim)
        if d is None or not (alvo_dias[0] <= d <= alvo_dias[1]):
            continue
        receita = valor(g, cds=["3.01"])
        res_bruto = valor(g, cds=["3.03"])
        ebit = valor(g, cds=["3.05"])
        # Padrão de mercado: lucro ATRIBUÍDO AOS CONTROLADORES (3.11.01),
        # não o consolidado com minoritários (auditoria de 31/07/2026 pegou
        # a diferença na WEG: 1,45 bi divulgado vs 1,58 bi consolidado).
        lucro = (
            valor(g, cds=["3.11.01"])
            or valor(g, ds_regex=r"^ATRIBUIDO A SOCIOS DA EMPRESA CONTROLADORA")
            or valor(g, ds_regex=r"^LUCRO/PREJUIZO CONSOLIDADO DO PERIODO")
            or valor(g, cds=["3.11"])
        )

        ba = bpa[(bpa["TICKER"] == ticker) & (bpa["DT_FIM_EXERC"] == fim)]
        bp = bpp[(bpp["TICKER"] == ticker) & (bpp["DT_FIM_EXERC"] == fim)]
        caixa = valor(ba, cds=["1.01.01", "1.01.02"])
        div_circ = valor(bp, cds=["2.01.04"])
        div_lp = valor(bp, cds=["2.02.01"])
        pl = valor(
            bp, ds_regex=r"^PATRIMONIO LIQUIDO CONSOLIDADO"
        ) or valor(bp, cds=["2.03"])

        divida = (div_circ or 0) + (div_lp or 0) if (div_circ or div_lp) else None
        div_liq = (divida - caixa) if (divida is not None and caixa is not None) else None
        mb = res_bruto / receita if (res_bruto and receita) else None
        ml = lucro / receita if (lucro and receita) else None
        roic = None
        if ebit is not None and pl and div_liq is not None and (pl + div_liq) > 0:
            roic = 0.66 * ebit / (pl + div_liq)
            if not anual:
                roic *= 4  # anualização simples do trimestre

        # período totalmente zerado (ex.: DFP consolidada da TIM vem vazia
        # no arquivo da CVM) é ruído — não gravar
        if not receita and not lucro and not pl:
            continue

        chave = (ticker, fim, fonte)
        resultados[chave] = dict(
            receita=receita, lucro=lucro, mb=mb, ml=ml, roic=roic,
            div_liq=div_liq, caixa=caixa, pl=pl,
        )


def sql_num(x):
    return "null" if x is None else f"{x:.4f}" if abs(x) < 1000 else f"{x:.0f}"


# ---------------------------------------------------------------------------
# COMPOSIÇÃO DE CAPITAL (nº total de ações) — fonte oficial para o valor de
# mercado usado no Valuation. Motivo (auditoria de 01/08/2026): a brapi
# informou market_cap errado para MULT3 (metade do real) e EGIE3 (~25% a
# mais). O arquivo *composicao_capital*.csv da CVM traz o número oficial.
# ---------------------------------------------------------------------------

def extrair_composicao(z: zipfile.ZipFile, acoes: dict):
    nomes = [n for n in z.namelist() if "composicao_capital" in n.lower()]
    if not nomes:
        return
    df = pd.read_csv(z.open(nomes[0]), sep=";", encoding="latin-1", dtype=str)
    df["TICKER"] = df["DENOM_CIA"].map(ticker_de)
    df = df[df["TICKER"].notna()].copy()
    # guardrail: 1 ticker = 1 razão social (mesma regra dos fundamentos)
    por = df.groupby("TICKER")["DENOM_CIA"].nunique()
    for tk in por[por > 1].index:
        log(f"  !! composicao_capital: conflito em {tk} — descartado")
    df = df[~df["TICKER"].isin(por[por > 1].index)]
    col = next((c for c in df.columns
                if "QT_ACAO_TOTAL" in c.upper() and "TESOUR" not in c.upper()),
               None)
    if col is None:
        log("  !! composicao_capital sem coluna de total de ações")
        return
    df["QT"] = pd.to_numeric(df[col], errors="coerce")
    df = df[df["QT"] > 0]
    df["VERSAO_N"] = pd.to_numeric(df["VERSAO"], errors="coerce")
    df = df.sort_values(["TICKER", "DT_REFER", "VERSAO_N"])
    for _, r in df.groupby("TICKER").tail(1).iterrows():
        atual = acoes.get(r["TICKER"])
        if atual is None or str(r["DT_REFER"]) > atual["ref"]:
            acoes[r["TICKER"]] = {"qtd": float(r["QT"]), "ref": str(r["DT_REFER"])}


def gerar_seed_acoes(acoes: dict, resultados: dict, rel_notas: list) -> list[dict]:
    """Gera 008_seed_acoes.sql normalizando a escala.

    Armadilha da CVM: cada companhia escolhe informar o nº de ações em
    UNIDADES ou em MILHARES (ex.: Engie informa 1.142.298.836 unidades;
    Ambev informa 15.763.665 = milhares). Heurística verificável: o lucro
    por ação implícito. Nenhuma ação brasileira lucra centenas de reais por
    papel — se |lucro anual| ÷ qtd > R$ 100, o número está em milhares.
    """
    if not acoes:
        return []
    linhas = []
    dados_json: list[dict] = []
    for ticker in sorted(acoes):
        qtd, ref = acoes[ticker]["qtd"], acoes[ticker]["ref"]
        lucros = sorted(
            (fim, m["lucro"]) for (t, fim, fonte), m in resultados.items()
            if t == ticker and fonte == "cvm_dfp" and m["lucro"]
        )
        lucro_ref = lucros[-1][1] if lucros else None
        if lucro_ref is not None and abs(lucro_ref) / qtd > 100:
            qtd *= 1000
            rel_notas.append(
                f"- {ticker}: composição informada em MILHARES → ×1000 "
                f"(lucro/ação normalizado: R$ {abs(lucro_ref)/qtd:.2f})")
        elif lucro_ref is None:
            rel_notas.append(
                f"- {ticker}: sem lucro anual para validar a escala do nº de "
                f"ações — valor bruto mantido ({qtd:.0f}), conferir")
        linhas.append(f"  ('{ticker}', {qtd:.0f}, '{ref}')")
        dados_json.append({"ticker": ticker, "qtd_acoes": round(qtd), "data_referencia": ref})

    corpo = ",\n".join(linhas)
    sql = f"""-- ENCORPEI INVEST — Migração 008: nº total de ações (fonte OFICIAL:
-- CVM, composicao_capital do ITR/DFP). Usado pelo motor para calcular o
-- valor de mercado (fechamento × qtd_acoes); brapi é apenas fallback.
-- Escala normalizada por lucro/ação (empresas informam ora em unidades,
-- ora em milhares). Gerado automaticamente pelo GitHub Actions em {date.today()}.

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
{corpo}
on conflict (ticker) do update
  set qtd_acoes = excluded.qtd_acoes,
      data_referencia = excluded.data_referencia,
      fonte = 'cvm_composicao_capital',
      atualizado_em = now();
"""
    with open("supabase/migrations/008_seed_acoes.sql", "w") as f:
        f.write(sql)
    log(f"acoes_totais: seed gerado com {len(linhas)} tickers")
    return dados_json


def main():
    resultados: dict = {}
    acoes: dict = {}

    for ano in ANOS_DFP:
        z = baixar_zip(f"{BASE}/DFP/DADOS/dfp_cia_aberta_{ano}.zip")
        if not z:
            continue
        extrair_composicao(z, acoes)
        dre = ler_csv(z, f"DRE_con_{ano}.csv")
        bpa = ler_csv(z, f"BPA_con_{ano}.csv")
        bpp = ler_csv(z, f"BPP_con_{ano}.csv")
        if dre is None or bpa is None or bpp is None:
            continue
        extrair(dre, bpa, bpp, anual=True, fonte="cvm_dfp", resultados=resultados)
        log(f"DFP {ano}: acumulado {len(resultados)} períodos")

    for ano in ANOS_ITR:
        z = baixar_zip(f"{BASE}/ITR/DADOS/itr_cia_aberta_{ano}.zip")
        if not z:
            continue
        extrair_composicao(z, acoes)
        dre = ler_csv(z, f"DRE_con_{ano}.csv")
        bpa = ler_csv(z, f"BPA_con_{ano}.csv")
        bpp = ler_csv(z, f"BPP_con_{ano}.csv")
        if dre is None or bpa is None or bpp is None:
            continue
        extrair(dre, bpa, bpp, anual=False, fonte="cvm_itr", resultados=resultados)
        log(f"ITR {ano}: acumulado {len(resultados)} períodos")

    # ---------- SQL ----------
    linhas_sql = []
    for (ticker, fim, fonte), m in sorted(resultados.items()):
        linhas_sql.append(
            f"  ('{ticker}', '{fim}', {sql_num(m['receita'])}, {sql_num(m['lucro'])}, "
            f"{sql_num(m['mb'])}, {sql_num(m['ml'])}, {sql_num(m['roic'])}, "
            f"{sql_num(m['div_liq'])}, {sql_num(m['caixa'])}, {sql_num(m['pl'])}, '{fonte}')"
        )
    sql = (
        "-- ENCORPEI INVEST — Migração 002: fundamentos (dados abertos CVM)\n"
        f"-- Gerado automaticamente pelo GitHub Actions em {date.today()}\n\n"
        "-- Correções de universo (idempotentes):\n"
        "insert into public.empresas (ticker, nome, setor) values\n"
        "  ('AXIA3', 'Axia Energia (ex-Eletrobras)', 'Energia Elétrica'),\n"
        "  ('CPLE3', 'Copel', 'Energia Elétrica')\n"
        "on conflict (ticker) do nothing;\n"
        "update public.empresas set ativo = false where ticker in ('ELET3','CPLE6');\n\n"
        "insert into public.fundamentos\n"
        "  (ticker, competencia, receita_liquida, lucro_liquido, margem_bruta,\n"
        "   margem_liquida, roic, divida_liquida, caixa, patrimonio_liquido, fonte)\n"
        "values\n" + ",\n".join(linhas_sql) + "\n"
        "on conflict (ticker, competencia, fonte) do update set\n"
        "  receita_liquida = excluded.receita_liquida,\n"
        "  lucro_liquido = excluded.lucro_liquido,\n"
        "  margem_bruta = excluded.margem_bruta,\n"
        "  margem_liquida = excluded.margem_liquida,\n"
        "  roic = excluded.roic,\n"
        "  divida_liquida = excluded.divida_liquida,\n"
        "  caixa = excluded.caixa,\n"
        "  patrimonio_liquido = excluded.patrimonio_liquido,\n"
        "  coletado_em = now();\n"
    )
    with open("supabase/migrations/002_seed_fundamentos.sql", "w") as f:
        f.write(sql)

    # ---------- nº de ações (valuation) ----------
    rel_notas_acoes: list = []
    acoes_json = gerar_seed_acoes(acoes, resultados, rel_notas_acoes) or []

    # ---------- JSON p/ sincronização AUTOMÁTICA diária (rota do app) ----------
    import json as _json
    import os as _os
    _os.makedirs("tools/dados", exist_ok=True)
    fundamentos_json = [
        {
            "ticker": t, "competencia": fim, "fonte": fonte,
            "receita_liquida": m["receita"], "lucro_liquido": m["lucro"],
            "margem_bruta": m["mb"], "margem_liquida": m["ml"], "roic": m["roic"],
            "divida_liquida": m["div_liq"], "caixa": m["caixa"],
            "patrimonio_liquido": m["pl"],
        }
        for (t, fim, fonte), m in sorted(resultados.items())
    ]
    with open("tools/dados/fundamentos.json", "w") as f:
        _json.dump({
            "gerado_em": str(date.today()),
            "fundamentos": fundamentos_json,
            "acoes_totais": acoes_json,
        }, f, ensure_ascii=False)
    log(f"JSON de sincronização: {len(fundamentos_json)} períodos + {len(acoes_json)} ações")

    # ---------- relatório ----------
    por_ticker = {}
    for (ticker, fim, fonte) in resultados:
        por_ticker.setdefault(ticker, []).append(f"{fim} ({fonte})")
    faltando = [t for t in MAPA if t not in por_ticker]

    rel = ["# Relatório do backfill CVM", f"Gerado em {date.today()}", ""]
    rel.append(f"Períodos extraídos: **{len(resultados)}** · "
               f"Empresas com dados: **{len(por_ticker)}/{len(MAPA)}**")
    if faltando:
        rel.append(f"\n## ⚠️ Sem dados (verificar mapeamento de nome): "
                   f"{', '.join(faltando)}")
        rel.append("\n### Diagnóstico — nomes parecidos vistos nos arquivos:\n")
        for t in faltando:
            dica = re.sub(r"[^A-Z ]", "", MAPA[t]).strip().split(" ")[0][:6]
            parecidos = sorted(n for n in NOMES_VISTOS if dica and dica in n)[:8]
            rel.append(f"- {t} (buscando '{dica}'): {parecidos or 'nenhum'}")
    if rel_notas_acoes:
        rel.append("\n## Composição de capital — ajustes de escala\n")
        rel += rel_notas_acoes
    rel.append("\n## Períodos por empresa\n")
    for t in sorted(por_ticker):
        rel.append(f"- **{t}**: {len(por_ticker[t])} períodos — "
                   f"{', '.join(sorted(por_ticker[t]))}")
    rel.append("\n## Log de execução\n")
    rel += [f"    {l}" for l in log_linhas]
    with open("tools/backfill_relatorio.md", "w") as f:
        f.write("\n".join(rel))
    log(f"OK: {len(resultados)} períodos, {len(por_ticker)} empresas, "
        f"{len(faltando)} sem dados")


if __name__ == "__main__":
    main()
