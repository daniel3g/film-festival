"use server";

import { refresh } from "next/cache";
import { adminClient, dbError, field, getActiveEdition, type ActionState } from "@/lib/admin";

export async function addJuror(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await adminClient();
  if (!supabase) return { error: "Sem permissão. Entre de novo como admin." };

  const edition = await getActiveEdition(supabase);
  if (!edition) return { error: "Nenhuma edição ativa." };

  const email = field(fd, "email")?.toLowerCase() ?? "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "E-mail inválido." };
  if (!email.endsWith(`@${edition.juror_email_domain}`)) {
    return { error: `O jurado precisa entrar com o e-mail @${edition.juror_email_domain}.` };
  }

  const { error } = await supabase
    .from("jurors")
    .insert({ edition_id: edition.id, email, name: field(fd, "name") });
  if (error) {
    return { error: error.code === "23505" ? "Esse jurado já está cadastrado." : dbError(error) };
  }

  refresh();
  return { message: `${email} cadastrado. Ele(a) já pode entrar com o Google.` };
}

export async function updateJurorName(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await adminClient();
  const id = field(fd, "id");
  if (!supabase || !id) return { error: "Sem permissão." };
  const { error } = await supabase.from("jurors").update({ name: field(fd, "name") }).eq("id", id);
  if (error) return { error: dbError(error) };
  refresh();
  return { message: "Salvo." };
}

export async function removeJuror(fd: FormData) {
  const supabase = await adminClient();
  const id = field(fd, "id");
  if (!supabase || !id) return;

  const { data: juror } = await supabase.from("jurors").select("email").eq("id", id).single();
  const { error } = await supabase.from("jurors").delete().eq("id", id);
  if (error) throw new Error(dbError(error, "Não foi possível remover."));
  await supabase.rpc("log_action", {
    p_action: "juror.remove",
    p_entity: "jurors",
    p_entity_id: id,
    p_details: { email: juror?.email ?? null },
  });
  refresh();
}
