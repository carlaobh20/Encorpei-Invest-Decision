/**
 * "POR QUÊ?" / "COMO CALCULAMOS?" — componente reutilizável (Bloco 2,
 * Sprint 2.5, Simplicity Layer).
 *
 * A spec pede DOIS botões em todo bloco da plataforma: "Por quê?" (dados
 * utilizados/motores envolvidos/evidências/hipóteses/limitações) e "Como
 * calculamos?" (fórmula/origem/versão/data/linha da CVM). Nenhum dos dois
 * abre sozinho — sempre fecha por padrão (`<details>`, mesmo padrão já
 * usado no Decision Center desde a Sprint 2.1).
 *
 * Este componente é o TOOLKIT — aplicado nesta sprint só ao Decision
 * Center (prova de conceito). Retrofit das outras telas (Meu Dash,
 * Empresas, Truth Layer, Memory Layer) fica para a Fase A2, registrado em
 * docs/simplicity-layer.md, não escondido.
 */

export type EvidenciaExibicao = { descricao: string; origem: string };

export type ConteudoPorQue = {
  dadosUtilizados: string[];
  motoresEnvolvidos: string[];
  evidencias: EvidenciaExibicao[];
  hipoteses: string[];
  limitacoes: string[];
};

export type ConteudoComoCalculamos = {
  formula: string;
  origem: string;
  versao: string | number | null;
  data: string | null;
  linhaCvm: string | null;
};

function Bloco({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-slate-500">{titulo}</p>
      <ul className="mt-1 space-y-0.5">
        {itens.map((item, i) => (
          <li key={i}>· {item}</li>
        ))}
      </ul>
    </div>
  );
}

export function PainelPorQue({ conteudo }: { conteudo: ConteudoPorQue }) {
  return (
    <details className="mt-2 rounded-lg border border-white/5 bg-black/20 p-2.5 text-[11px]">
      <summary className="cursor-pointer select-none font-semibold text-sky-400/90">Por quê?</summary>
      <div className="mt-2 space-y-2.5 text-slate-300">
        <Bloco titulo="Dados utilizados" itens={conteudo.dadosUtilizados} />
        <Bloco titulo="Motores envolvidos" itens={conteudo.motoresEnvolvidos} />
        {conteudo.evidencias.length > 0 && (
          <div>
            <p className="text-[9px] uppercase tracking-wider text-slate-500">Evidências</p>
            <ul className="mt-1 space-y-0.5">
              {conteudo.evidencias.map((e, i) => (
                <li key={i}>
                  · {e.descricao} <span className="text-slate-600">({e.origem})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <Bloco titulo="Hipóteses" itens={conteudo.hipoteses} />
        <Bloco titulo="Limitações" itens={conteudo.limitacoes} />
      </div>
    </details>
  );
}

export function PainelComoCalculamos({ conteudo }: { conteudo: ConteudoComoCalculamos }) {
  return (
    <details className="mt-2 rounded-lg border border-white/5 bg-black/20 p-2.5 text-[11px]">
      <summary className="cursor-pointer select-none font-semibold text-sky-400/90">Como calculamos?</summary>
      <div className="mt-2 space-y-1.5 text-slate-300">
        <p>
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Fórmula: </span>
          {conteudo.formula}
        </p>
        <p>
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Origem: </span>
          {conteudo.origem}
        </p>
        <p>
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Versão: </span>
          {conteudo.versao ?? "—"}
        </p>
        <p>
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Data: </span>
          {conteudo.data ?? "—"}
        </p>
        <p>
          <span className="text-[9px] uppercase tracking-wider text-slate-500">Linha da CVM: </span>
          {conteudo.linhaCvm ?? "Não aplicável — a fonte entrega dado estruturado (XBRL/JSON), não PDF escaneado."}
        </p>
      </div>
    </details>
  );
}
