import { describe, expect, it } from "vitest";
import { emitirEvidenciasComunicados, type ComunicadoOficialRow } from "./memory-layer-comunicados";

describe("emitirEvidenciasComunicados", () => {
  it("mapeia campos estruturados do comunicado sem interpretar sentimento (pesoInformativo sempre 0)", () => {
    const rows: ComunicadoOficialRow[] = [
      { ticker: "PETR4", data_entrega: "2026-07-30", categoria: "Fato Relevante", assunto: "Aprovação de plano de investimentos", link: "https://cvm.gov.br/x", protocolo: "999" },
    ];
    const [e] = emitirEvidenciasComunicados(rows);
    expect(e.ticker).toBe("PETR4");
    expect(e.categoria).toBe("outro");
    expect(e.pesoInformativo).toBe(0);
    expect(e.confiabilidade).toBe("alta");
    expect(e.subcategoria).toBe("Estratégico");
    expect(e.urlOficial).toBe("https://cvm.gov.br/x");
    expect(e.documentoOficial).toBe("999");
    expect(e.descricao).toContain("Aprovação de plano de investimentos");
  });

  it("classifica apresentações a investidores como Financeiro na subcategoria de exibição", () => {
    const rows: ComunicadoOficialRow[] = [
      { ticker: "VALE3", data_entrega: "2026-07-29", categoria: "Apresentacoes a Investidores", assunto: "Apresentação 2T26", link: null, protocolo: null },
    ];
    const [e] = emitirEvidenciasComunicados(rows);
    expect(e.subcategoria).toBe("Financeiro");
    expect(e.urlOficial).toBeNull();
  });

  it("cai em Estratégico (default honesto) para categoria CVM não mapeada — nunca inventa uma subcategoria mais específica", () => {
    const rows: ComunicadoOficialRow[] = [
      { ticker: "ITUB4", data_entrega: "2026-07-28", categoria: "Assembleia Geral", assunto: "Convocação de AGO", link: null, protocolo: "1" },
    ];
    const [e] = emitirEvidenciasComunicados(rows);
    expect(e.subcategoria).toBe("Estratégico");
  });

  it("trunca título muito longo em 80 caracteres com reticências", () => {
    const assuntoLongo = "A".repeat(120);
    const rows: ComunicadoOficialRow[] = [
      { ticker: "ITUB4", data_entrega: "2026-07-28", categoria: "Fato Relevante", assunto: assuntoLongo, link: null, protocolo: null },
    ];
    const [e] = emitirEvidenciasComunicados(rows);
    expect(e.titulo.length).toBe(80);
    expect(e.titulo.endsWith("...")).toBe(true);
  });
});
