"use client";

import { useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function Logout() {
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    supabase.auth.signOut().finally(() => {
      window.location.href = "/login";
    });
  }, []);
  return (
    <main className="flex h-dvh items-center justify-center bg-slate-950 text-slate-400">
      Saindo…
    </main>
  );
}
