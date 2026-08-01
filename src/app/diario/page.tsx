import { revalidatePath } from "next/cache";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { Shell } from "@/components/Shell";

export const dynamic = "force-dynamic";

type Decisao = {
  id: number;
  ticker: string;
  decisao: string;
  justificativa: string;
  contexto: {
    score?: number | null;
    status_tese?: string | null;
    preco?: number | null;
  } | null;
  criado_em: string;
};

const DECISAO_UI: Record<string, { rotulo: string; cor: string }> = {
  comprei: { rotulo: "Comprei", cor: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  aumentei: { rotulo: "Aumentei", cor: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30" },
  vendi: { rotulo: "Vendi", cor: "text-red-300 bg-red-500/10 border-red-500/30" },
  reduzi: { rotulo: "Reduzi", cor: "text-amber-300 bg-amber-500/10 border-amber-500/30" },
  mantive: { rotulo: "Mantive", cor: "text-sky-300 bg-sky-500/10 border-sky-500/30" },
  observei: { rotulo: "Só observei", cor: "text-slate-300 bg-white/5 border-white/15" },
};

function fmtData(d: string) {
  return new Date(d).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
  });
}

async function registrarDecisao(formData: FormData) {
  "use server";
  const { timingSafeEqual } = await import("node:crypto");
  const chave = String(formData.get("chave") ?? "");
  const ticker = String(formData.get("ticker") ?? "").toUpperCase();
  const decisao = String(formData.get("decisao") ?? "");
  const justificativa = String(formData.get("justificativa") ?? "").trim();

  // PIN próprio do diário (DIARIO_PIN); comparação em tempo constante.
  // Fallback temporário para CRON_SECRET até o PIN ser criado na Vercel.
  const pin = process.env.DIARIO_PIN ?? process.env.CRON_SECRET ?? "";
  const a = Buffer.from(chave);
  const b = Buffer.from(pin);
  const ok = pin.length > 0 && a.length === b.length && timingSafeEqual(a, b);
  if (!ok) return; // chave errada: ignora em silêncio
  if (!ticker || !decisao || justificativa.length < 10) return;

  const admin = getSupabaseAdmin();
  if (!admin) return;

  // foto do momento: nota, status da tese e preço mais recentes
  const [{ data: sc }, { data: ts }, { data: pr }] = await Promise.all([
    admin.from("scores").select("score_final").eq("ticker", ticker)
      .order("data", { ascending: false }).limit(1),
    admin.from("teses").select("status").eq("ticker", ticker).eq("ativa", true).limit(1),
    admin.from("precos_diarios").select("fechamento").eq("ticker", ticker)
      .order("data", { ascending: false }).limit(1),
  ]);

  await admin.from("decisoes").insert({
    ticker,
    decisao,
    justificativa,
    contexto: {
      score: sc?.[0]?.score_final ?? null,
      status_tese: ts?.[0]?.status ?? null,
      preco: pr?.[0]?.fechamento ?? null,
    },
  });
  revalidatePath("/diario");
}

export default async function Diario() {
  if (!isSupabaseConfigured || !supabase) {
    return (
      <Shell ativo="/diario" titulo="Diário de Decisão">
        <p className="text-slate-400">Supabase não configurado.</p>
      </Shell>
    );
  }

  const [{ data: decisoesRaw }, { data: tesesRaw }] = await Promise.all([
    supabase
      .from("decisoes")
      .select("id, ticker, decisao, justificativa, contexto, criado_em")
      .order("criado_em", { ascending: false })
      .limit(100),
    supabase.from("teses").select("ticker").eq("ativa", true).order("ticker"),
  ]);
  const decisoes = (decisoesRaw as Decisao[]) ?? [];
  const tickers = ((tesesRaw as { ticker: string }[]) ?? []).map((t) => t.ticker);

  return (
    <Shell
      ativo="/diario"
      titulo="Diário de Decisão"
      subtitulo="Cada decisão sua, registrada com a foto do que o sistema dizia no momento. É este diário que vai responder, com dados, se o Encorpei melhora suas decisões — o verdadeiro progresso do negócio."
    >
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
        {/* ---------- registrar ---------- */}
        <section className="col-span-12 rounded-2xl border border-white/5 bg-white/[0.03] p-5 lg:col-span-4">
          <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
            Registrar decisão
          </h2>
          <form action={registrarDecisao} className="mt-3 space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <select
                name="ticker"
                required
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 focus:border-emerald-500/50 focus:outline-none"
              >
                <option value="">Empresa…</option>
                {tickers.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                name="decisao"
                required
                className="rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 focus:border-emerald-500/50 focus:outline-none"
              >
                <option value="">O que fiz…</option>
                <option value="comprei">Comprei</option>
                <option value="aumentei">Aumentei posição</option>
                <option value="reduzi">Reduzi posição</option>
                <option value="vendi">Vendi</option>
                <option value="mantive">Mantive</option>
                <option value="observei">Só observei</option>
              </select>
            </div>
            <textarea
              name="justificativa"
              required
              minLength={10}
              rows={4}
              placeholder="Por quê? (mínimo 10 caracteres — seu eu do futuro agradece a honestidade)"
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
            />
            <input
              type="password"
              name="chave"
              required
              placeholder="Chave do sistema"
              className="w-full rounded-lg border border-white/10 bg-slate-900 px-3 py-2 text-slate-200 placeholder:text-slate-600 focus:border-emerald-500/50 focus:outline-none"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-500"
            >
              Registrar (imutável)
            </button>
            <p className="text-[10px] leading-snug text-slate-600">
              Use o PIN do diário (definido na Vercel como DIARIO_PIN). Com o
              login da Fase 4 ele deixa de ser necessário. O registro guarda
              automaticamente a nota, o status da tese e o preço do momento.
            </p>
          </form>
        </section>

        {/* ---------- histórico ---------- */}
        <section className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-white/5 bg-white/[0.03] p-5 lg:col-span-8">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
              Histórico ({decisoes.length})
            </h2>
            <p className="text-[10px] text-slate-600">imutável — decisão não se edita, se registra outra</p>
          </div>
          <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {decisoes.length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhuma decisão registrada ainda. A primeira entrada deste
                diário é o começo do seu track record.
              </p>
            )}
            {decisoes.map((d) => {
              const ui = DECISAO_UI[d.decisao] ?? DECISAO_UI.observei;
              return (
                <div key={d.id} className="rounded-xl border border-white/5 bg-white/[0.02] p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold">{d.ticker}</span>
                      <span className={`rounded-full border px-2.5 py-0.5 text-[11px] ${ui.cor}`}>
                        {ui.rotulo}
                      </span>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider text-slate-600">
                      {fmtData(d.criado_em)}
                    </span>
                  </div>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-300">
                    {d.justificativa}
                  </p>
                  {d.contexto && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      Foto do momento:{" "}
                      {d.contexto.score != null && <>nota {d.contexto.score} · </>}
                      {d.contexto.status_tese && <>tese {d.contexto.status_tese} · </>}
                      {d.contexto.preco != null && (
                        <>preço R$ {Number(d.contexto.preco).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</>
                      )}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </Shell>
  );
}
