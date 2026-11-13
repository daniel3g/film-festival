import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "juror" | "none";

/** Usuário logado e papel na plataforma (uma vez por requisição). */
export const getSessionInfo = cache(async () => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;
  if (!claims?.sub) return { email: null, role: "none" as AppRole };

  const { data: role } = await supabase.rpc("current_app_role");
  return {
    email: (claims.email as string | undefined) ?? null,
    role: (role ?? "none") as AppRole,
  };
});

/** Para layouts protegidos: garante o papel ou redireciona. */
export async function requireRole(role: Exclude<AppRole, "none">) {
  const info = await getSessionInfo();
  if (!info.email) redirect("/entrar");
  if (info.role !== role) redirect("/entrar?erro=sem-acesso");
  return info;
}

/** Página inicial de cada papel. */
export function homeFor(role: AppRole) {
  return role === "admin" ? "/admin" : role === "juror" ? "/juri" : "/entrar";
}
