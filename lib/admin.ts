import "server-only";
import { createClient } from "@/lib/supabase/server";

export type ActionState = { error?: string; message?: string } | undefined;

/**
 * Para Server Actions do admin: devolve o cliente com a sessão (RLS continua
 * valendo) ou null se quem chamou não é admin.
 */
export async function adminClient() {
  const supabase = await createClient();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  return isAdmin ? supabase : null;
}

export type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export async function getActiveEdition(supabase: SupabaseServer) {
  const { data } = await supabase
    .from("editions")
    .select("id, name, juror_email_domain")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

/** Lê um campo de texto do formulário (vazio vira null). */
export function field(fd: FormData, name: string): string | null {
  const v = fd.get(name);
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t === "" ? null : t;
}

/** Traduz erros do Postgres para mensagens em português. */
export function dbError(error: { code?: string; message: string }, fallback = "Não foi possível salvar.") {
  if (error.code === "23505") return "Já existe um cadastro com esses dados.";
  if (error.code === "23514" || error.code === "P0001") return error.message;
  if (error.code === "42501") return "Sem permissão.";
  return `${fallback} (${error.message})`;
}
