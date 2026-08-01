# Revisão de Segurança — Encorpei Invest

Auditoria de 01/08/2026 (skill de segurança do Encorpei). Escopo: código do
repositório, políticas RLS, rotas, server actions e gestão de segredos.
**Não coberto**: pentest formal, revisão da conta Vercel/Supabase em si.

## 🔴 Crítico — ações tomadas e pendentes

**1. CRON_SECRET comprometido por design.** O valor circulou em chat e em
URLs (query string fica em logs de acesso e histórico de navegador).
Cenário: quem tiver o valor dispara coletas (dano baixo) e — pior —
registrava entradas no Diário de Decisão, corrompendo o track record.
- ✅ Corrigido no código: rotas aceitam APENAS header `Authorization: Bearer`
  (crons da Vercel já enviam assim; nada quebra). Query `?secret=` removida.
- ✅ Diário passou a usar PIN próprio (`DIARIO_PIN`) com comparação em tempo
  constante (anti-timing-attack); fallback temporário para CRON_SECRET.
- ⏳ PENDENTE (Carlos, 2 min na Vercel): criar `DIARIO_PIN` (valor novo, que
  NUNCA passe por chat) e **rotacionar** `CRON_SECRET` (Settings → Environment
  Variables → editar valor → Redeploy). Depois disso, o valor antigo vira lixo.

## 🟡 Importante

**2. Leitura pública de tudo (sem Auth).** Teses, notas, eventos e DIÁRIO são
legíveis por qualquer pessoa com a URL. Para app pessoal o dano é privacidade
do próprio dono (o diário revela comportamento financeiro). Correção real =
Supabase Auth (Fase 4, requer o Carlos presente para definir a senha); as
políticas atuais estão marcadas "temporária" no SQL justamente para isso.

**3. Sem rate-limit nas rotas/ação do diário.** Mitigado parcialmente com
comparação em tempo constante e PIN longo; resolvido de fato com Auth.

## 🟢 Endurecimento aplicado

- Headers de segurança em todas as respostas: `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY` (anti-clickjacking), `Referrer-Policy`,
  `Permissions-Policy`.

## ✅ O que está bem (verificado, não presumido)

- Nenhum segredo no repositório (grep no histórico do working tree) e
  `.env*` no gitignore; service_role usada só no servidor via env.
- RLS habilitado em TODAS as tabelas; `dados_brutos` invisível para clientes.
- Escrita nos dados de mercado/teses/scores: só o servidor (nenhuma policy
  de INSERT/UPDATE para anon).
- `eventos_tese`, `scores` e `decisoes` imutáveis até para service_role
  (REVOKE update/delete) — auditoria não reescreve o passado.
- Token GitHub do deploy: NÃO está no código. (O token classic colado no
  chat em 31/07 segue precisando de revogação manual pelo Carlos.)

## LGPD (nota para o futuro comercial)

Hoje o app trata dados de UM titular (o dono). Terceiros no fluxo: Vercel,
Supabase, brapi, GitHub, Resend (quando ativado) — mapear em contrato antes
de qualquer abertura ao público, junto com Auth, exclusão de conta e o
parecer CVM já previsto na Fase 6/7 do roadmap.
