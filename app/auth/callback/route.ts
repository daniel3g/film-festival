import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { homeFor, type AppRole } from "@/lib/auth";

/** Volta do Google: cria a sessão, liga a conta ao cadastro e manda para a área certa. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = searchParams.get("next");

  if (!code) {
    return NextResponse.redirect(`${origin}/entrar?erro=falha-login`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/entrar?erro=falha-login`);
  }

  const { data } = await supabase.rpc("link_current_user");
  const role = (data ?? "none") as AppRole;

  if (role === "none") {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/entrar?erro=sem-acesso`);
  }

  // Só aceita destino interno e compatível com o papel.
  const home = homeFor(role);
  const safeNext =
    next && next.startsWith(home) && !next.startsWith("//") ? next : home;
  return NextResponse.redirect(`${origin}${safeNext}`);
}
