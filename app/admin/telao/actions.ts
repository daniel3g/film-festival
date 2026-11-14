"use server";

import { refresh } from "next/cache";
import { adminClient, dbError, getActiveEdition, type ActionState } from "@/lib/admin";
import type { Cue } from "@/lib/telao";

const CUES: Cue[] = ["abertura", "bastidores", "ambiente", "suspense", "fanfarra", "fanfarra_pc", "encerramento"];

/** Registra a faixa enviada (já está no Storage) para um momento, na edição toda. */
export async function setTrack(cue: Cue, path: string, fileName: string, size: number): Promise<ActionState> {
  const supabase = await adminClient();
  if (!supabase) return { error: "Sem permissão." };
  if (!CUES.includes(cue)) return { error: "Momento inválido." };
  const edition = await getActiveEdition(supabase);
  if (!edition) return { error: "Nenhuma edição ativa." };
  if (!path.startsWith(`${edition.id}/`)) return { error: "Caminho inválido." };

  const { data: old } = await supabase
    .from("soundtrack_tracks")
    .select("id, storage_path")
    .eq("edition_id", edition.id)
    .is("ceremony_id", null)
    .eq("cue", cue)
    .maybeSingle();

  const row = { storage_path: path, file_name: fileName.slice(0, 200), size_bytes: size };
  const { error } = old
    ? await supabase.from("soundtrack_tracks").update(row).eq("id", old.id)
    : await supabase.from("soundtrack_tracks").insert({ ...row, edition_id: edition.id, cue });
  if (error) return { error: dbError(error) };

  if (old && old.storage_path !== path) await supabase.storage.from("soundtrack").remove([old.storage_path]);
  await supabase.rpc("log_action", { p_action: "soundtrack.set", p_entity: "editions", p_entity_id: edition.id, p_details: { cue, fileName } });
  refresh();
  return { message: "Faixa salva." };
}

/** Volta a usar o exemplo gerado pelo navegador. */
export async function removeTrack(cue: Cue): Promise<ActionState> {
  const supabase = await adminClient();
  if (!supabase) return { error: "Sem permissão." };
  const edition = await getActiveEdition(supabase);
  if (!edition) return { error: "Nenhuma edição ativa." };

  const { data: old } = await supabase
    .from("soundtrack_tracks")
    .select("id, storage_path")
    .eq("edition_id", edition.id)
    .is("ceremony_id", null)
    .eq("cue", cue)
    .maybeSingle();
  if (!old) return { message: "Já está usando o exemplo." };

  const { error } = await supabase.from("soundtrack_tracks").delete().eq("id", old.id);
  if (error) return { error: dbError(error) };
  await supabase.storage.from("soundtrack").remove([old.storage_path]);
  await supabase.rpc("log_action", { p_action: "soundtrack.remove", p_entity: "editions", p_entity_id: edition.id, p_details: { cue } });
  refresh();
  return { message: "Voltou para o exemplo." };
}
