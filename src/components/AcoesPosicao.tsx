"use client";

/**
 * Botões "editar" / "excluir" por linha da Carteira.
 *
 * Antes disso: registrar de novo já ATUALIZAVA a posição, e quantidade 0 já
 * REMOVIA — mas nada na tela dizia isso nem fazia por você (Carlos precisava
 * lembrar a regra e redigitar tudo do zero). Isso só torna as duas ações
 * existentes descobríveis e sem retrabalho:
 *  - "editar" preenche o formulário à esquerda com os dados desta linha
 *    (client-side, sem chamar o servidor — só facilita o reenvio).
 *  - "excluir" envia quantidade=0 pro mesmo server action que já apagava
 *    (salvarPosicao em carteira/page.tsx), com uma confirmação antes.
 */
export function AcoesPosicao({
  ticker,
  quantidade,
  precoMedio,
  dataCompra,
  excluirAction,
}: {
  ticker: string;
  quantidade: number;
  precoMedio: number;
  dataCompra: string | null;
  excluirAction: (formData: FormData) => void;
}) {
  function editar() {
    const sel = document.getElementById("f-ticker") as HTMLSelectElement | null;
    const qtd = document.getElementById("f-quantidade") as HTMLInputElement | null;
    const preco = document.getElementById("f-preco") as HTMLInputElement | null;
    const data = document.getElementById("f-data") as HTMLInputElement | null;
    if (sel) sel.value = ticker;
    if (qtd) qtd.value = String(quantidade);
    if (preco) preco.value = String(precoMedio).replace(".", ",");
    if (data) data.value = dataCompra ?? "";
    document.getElementById("form-posicao")?.scrollIntoView({ behavior: "smooth", block: "start" });
    sel?.focus();
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={editar}
        className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] text-slate-400 transition-colors hover:border-sky-400/50 hover:text-sky-300"
      >
        editar
      </button>
      <form
        action={excluirAction}
        onSubmit={(e) => {
          if (
            !confirm(
              `Remover ${ticker} da carteira? O histórico de decisões já registrado no Diário não é afetado — isso só tira a posição do estado atual.`
            )
          ) {
            e.preventDefault();
          }
        }}
        className="inline"
      >
        <input type="hidden" name="ticker" value={ticker} />
        <input type="hidden" name="quantidade" value="0" />
        <button
          type="submit"
          className="rounded border border-red-500/20 px-1.5 py-0.5 text-[10px] text-red-400/80 transition-colors hover:border-red-400/50 hover:text-red-300"
        >
          excluir
        </button>
      </form>
    </span>
  );
}
