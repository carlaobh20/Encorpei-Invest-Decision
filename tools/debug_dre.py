"""
Debug: imprime as linhas brutas da DRE consolidada de LOCALIZA, TOTVS e TIM
para achar a causa das divergências detectadas na auditoria de 31/07/2026:
- RENT3: receita/lucro ~24%/41% acima do divulgado
- TOTS3: receita +6,3% acima do divulgado
- TIMS3: DFP anual veio zerada

Gera tools/debug_dre.md (commitado pelo workflow).
"""

import io
import re
import time
import unicodedata
import zipfile

import pandas as pd
import requests

BASE = "https://dados.cvm.gov.br/dados/CIA_ABERTA/DOC"
ALVOS = {
    "RENT3": r"^LOCALIZA",
    "TOTS3": r"^TOTVS",
    "TIMS3": r"^TIM S\.?A",
}

saida = ["# Debug DRE — Localiza, Totvs e TIM", ""]


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


def dump(z, sufixo, titulo, so_periodo_curto):
    nomes = [n for n in z.namelist() if n.endswith(sufixo)]
    if not nomes:
        saida.append(f"## {titulo}: arquivo *{sufixo} não encontrado")
        return
    df = pd.read_csv(z.open(nomes[0]), sep=";", encoding="latin-1", dtype=str)
    df["DENOM_N"] = df["DENOM_CIA"].map(sem_acento)
    for ticker, padrao in ALVOS.items():
        sel = df[df["DENOM_N"].str.contains(padrao, regex=True, na=False)]
        if sel.empty:
            continue
        saida.append(f"\n## {titulo} — {ticker} "
                     f"(DENOM: {sel['DENOM_CIA'].iloc[0]})\n")
        sel = sel[sel["ORDEM_EXERC"].str.upper().str.startswith(("Ú", "U"))]
        cols = [c for c in ["GRUPO_DFP", "MOEDA", "ESCALA_MOEDA", "VERSAO",
                            "DT_INI_EXERC", "DT_FIM_EXERC", "CD_CONTA",
                            "DS_CONTA", "VL_CONTA"] if c in sel.columns]
        # períodos disponíveis
        per = sel.groupby(["DT_INI_EXERC", "DT_FIM_EXERC"]).size().reset_index(name="linhas")
        saida.append("Períodos no arquivo (ORDEM=ÚLTIMO):")
        for _, p in per.iterrows():
            saida.append(f"- {p['DT_INI_EXERC']} → {p['DT_FIM_EXERC']}: {p['linhas']} linhas")
        # linhas de interesse: contas de nível alto
        interesse = sel[sel["CD_CONTA"].str.match(r"^3\.\d{2}(\.\d{2})?$", na=False)]
        if so_periodo_curto and "DT_INI_EXERC" in interesse.columns:
            d = (pd.to_datetime(interesse["DT_FIM_EXERC"]) -
                 pd.to_datetime(interesse["DT_INI_EXERC"])).dt.days
            interesse = interesse[(d >= 80) & (d <= 100)]
        saida.append("\n| grupo | ini | fim | conta | descrição | valor |")
        saida.append("|---|---|---|---|---|---|")
        for _, r in interesse.iterrows():
            saida.append(
                f"| {r.get('GRUPO_DFP','')} | {r.get('DT_INI_EXERC','')} | "
                f"{r['DT_FIM_EXERC']} | {r['CD_CONTA']} | {r['DS_CONTA']} | "
                f"{r['VL_CONTA']} |")
        # contagem de duplicatas por conta+período
        dup = interesse.groupby(
            ["DT_INI_EXERC", "DT_FIM_EXERC", "CD_CONTA"]
        ).size().reset_index(name="n")
        dups = dup[dup["n"] > 1]
        if len(dups):
            saida.append(f"\n**DUPLICATAS detectadas ({len(dups)}):**")
            for _, r in dups.iterrows():
                saida.append(f"- {r['CD_CONTA']} em {r['DT_INI_EXERC']}→"
                             f"{r['DT_FIM_EXERC']}: {r['n']} linhas")
        else:
            saida.append("\nSem duplicatas de conta no período filtrado.")


z_itr = baixar(f"{BASE}/ITR/DADOS/itr_cia_aberta_2026.zip")
dump(z_itr, "DRE_con_2026.csv", "ITR 2026 (1T26)", so_periodo_curto=False)

z_dfp = baixar(f"{BASE}/DFP/DADOS/dfp_cia_aberta_2025.zip")
dump(z_dfp, "DRE_con_2025.csv", "DFP 2025 (anual — foco TIM)", so_periodo_curto=False)

with open("tools/debug_dre.md", "w") as f:
    f.write("\n".join(saida))
print(f"ok: {len(saida)} linhas de relatório")
