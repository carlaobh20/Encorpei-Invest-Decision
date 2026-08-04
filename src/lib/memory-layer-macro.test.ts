import { describe, expect, it } from "vitest";
import { agruparSerieMacro, emitirEvidenciasMacro, type MacroFocusRow } from "./memory-layer-macro";

describe("agruparSerieMacro", () => {
  it("agrupa por indicador+ano e ordena por data de pesquisa ascendente", () => {
    const rows: MacroFocusRow[] = [
      { indicador: "Selic", data_pesquisa: "2026-07-10", ano_referencia: 2026, mediana: 14.0 },
      { indicador: "Selic", data_pesquisa: "2026-07-03", ano_referencia: 2026, mediana: 14.0 },
      { indicador: "IPCA", data_pesquisa: "2026-07-10", ano_referencia: 2026, mediana: 5.1 },
    ];
    const grupos = agruparSerieMacro(rows);
    expect(grupos.size).toBe(2);
    const selic = grupos.get("Selic|2026")!;
    expect(selic.map((r) => r.data_pesquisa)).toEqual(["2026-07-03", "2026-07-10"]);
  });
});

describe("emitirEvidenciasMacro", () => {
  it("emite uma evidência por empresa do universo quando a mediana muda acima do limiar", () => {
    const rows: MacroFocusRow[] = [
      { indicador: "Selic", data_pesquisa: "2026-07-24", ano_referencia: 2026, mediana: 14.0 },
      { indicador: "Selic", data_pesquisa: "2026-07-31", ano_referencia: 2026, mediana: 13.75 },
    ];
    const serie = agruparSerieMacro(rows);
    const r = emitirEvidenciasMacro(serie, ["PETR4", "VALE3"]);
    expect(r).toHaveLength(2);
    expect(r.map((e) => e.ticker).sort()).toEqual(["PETR4", "VALE3"]);
    expect(r[0].categoria).toBe("macro_focus");
    expect(r[0].pesoInformativo).toBe(0); // nunca interpreta se é bom ou ruim
    expect(r[0].subcategoria).toBe("Macro");
  });

  it("não emite nada quando a mudança fica abaixo do limiar do indicador", () => {
    const rows: MacroFocusRow[] = [
      { indicador: "IPCA", data_pesquisa: "2026-07-24", ano_referencia: 2026, mediana: 5.12 },
      { indicador: "IPCA", data_pesquisa: "2026-07-31", ano_referencia: 2026, mediana: 5.15 },
    ];
    const serie = agruparSerieMacro(rows);
    const r = emitirEvidenciasMacro(serie, ["PETR4"]);
    expect(r).toHaveLength(0);
  });

  it("usa limiar padrão de 0,1 para indicador fora da tabela conhecida", () => {
    const rows: MacroFocusRow[] = [
      { indicador: "Novo Indicador", data_pesquisa: "2026-07-24", ano_referencia: 2026, mediana: 1.0 },
      { indicador: "Novo Indicador", data_pesquisa: "2026-07-31", ano_referencia: 2026, mediana: 1.2 },
    ];
    const serie = agruparSerieMacro(rows);
    const r = emitirEvidenciasMacro(serie, ["PETR4"]);
    expect(r).toHaveLength(1);
  });

  it("registra variação negativa sem o sinal '+' na descrição", () => {
    const rows: MacroFocusRow[] = [
      { indicador: "Selic", data_pesquisa: "2026-07-24", ano_referencia: 2026, mediana: 14.0 },
      { indicador: "Selic", data_pesquisa: "2026-07-31", ano_referencia: 2026, mediana: 13.5 },
    ];
    const serie = agruparSerieMacro(rows);
    const r = emitirEvidenciasMacro(serie, ["PETR4"]);
    expect(r[0].descricao).not.toContain("(+");
    expect(r[0].descricao).toContain("(-0,5)");
  });

  it("universo vazio nunca gera evidência, mesmo com mudança relevante — sem empresa, sem linha (FK obrigatória)", () => {
    const rows: MacroFocusRow[] = [
      { indicador: "Selic", data_pesquisa: "2026-07-24", ano_referencia: 2026, mediana: 14.0 },
      { indicador: "Selic", data_pesquisa: "2026-07-31", ano_referencia: 2026, mediana: 13.0 },
    ];
    const serie = agruparSerieMacro(rows);
    const r = emitirEvidenciasMacro(serie, []);
    expect(r).toHaveLength(0);
  });
});
