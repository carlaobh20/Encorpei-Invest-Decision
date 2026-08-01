import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Porteiro do app — DORME até NEXT_PUBLIC_AUTH_ATIVO=true na Vercel.
 * Quando ativo: renova a sessão e exige login em todas as páginas
 * (rotas /api ficam de fora — os crons autenticam por header próprio).
 */
export async function middleware(req: NextRequest) {
  if (process.env.NEXT_PUBLIC_AUTH_ATIVO !== "true") {
    return NextResponse.next();
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return NextResponse.next();

  let res = NextResponse.next({ request: req });
  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, options)
        );
      },
    },
  });

  const { data } = await supabase.auth.getUser();
  const ehLogin = req.nextUrl.pathname.startsWith("/login");

  if (!data.user && !ehLogin) {
    const destino = req.nextUrl.clone();
    destino.pathname = "/login";
    return NextResponse.redirect(destino);
  }
  if (data.user && ehLogin) {
    const destino = req.nextUrl.clone();
    destino.pathname = "/";
    return NextResponse.redirect(destino);
  }
  return res;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|icon.svg|manifest.webmanifest|favicon.ico).*)"],
};
