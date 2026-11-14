"use server";

import { refresh } from "next/cache";
import { adminClient, dbError, field, type ActionState } from "@/lib/admin";
import { computeJuryResults, loadJuryData } from "@/lib/results";

const NO_ACCESS: ActionState = { error: "Sem permissão. Entre de novo como admin." };

/** Encerra ou reabre a avaliação do júri da edição ativa. */
export async function setJuryStatus(fd: FormData): Promise<void> {
  const supabase = await adminClient();
  const status = field(fd, "status");
  if (!supabase || (status !== "open" && status !== "closed")) return;

  const { data: edition } = await supabase.from("editions").select("id, jury_status").eq("is_active", true).single();
  if (!edition || edition.jury_status === status) return;

  if (status === "open") {
    // Reabrir pode mudar as médias: os desempates deixam de valer.
    const { data: cers } = await supabase.from("ceremonies").select("id").eq("edition_id", edition.id);
    const ids = (cers ?? []).map((c) => c.id);
    if (ids.length) await supabase.from("tiebreaks").delete().in("ceremony_id", ids);
  }

  const { error } = await supabase.from("editions").update({ jury_status: status }).eq("id", edition.id);
  if (error) throw new Error(dbError(error));

  await supabase.rpc("log_action", {
    p_action: status === "closed" ? "jury.close" : "jury.reopen",
    p_entity: "editions",
    p_entity_id: edition.id,
  });
  refresh();
}

/** Abre uma rodada de desempate para um empate no 1º lugar (recalculado aqui no servidor). */
export async function openTiebreak(fd: FormData): Promise<void> {
  const supabase = await adminClient();
  const ceremonyId = field(fd, "ceremony_id");
  const categoryId = field(fd, "category_id");
  if (!supabase || !ceremonyId || !categoryId) return;

  const data = await loadJuryData(supabase);
  if (data.edition?.jury_status !== "closed") throw new Error("Encerre a avaliação antes de abrir desempates.");

  const result = computeJuryResults(data).find((r) => r.ceremonyId === ceremonyId && r.category.id === categoryId);
  if (!result?.tiedRefs) throw new Error("Não há empate nesta categoria.");
  if (result.tiebreak) return; // já existe

  const { data: tb, error } = await supabase
    .from("tiebreaks")
    .insert({ ceremony_id: ceremonyId, category_id: categoryId, tied_refs: result.tiedRefs })
    .select("id")
    .single();
  if (error) throw new Error(dbError(error));

  await supabase.rpc("log_action", {
    p_action: "tiebreak.open",
    p_entity: "tiebreaks",
    p_entity_id: tb.id,
    p_details: { category: result.category.code, tied: result.tiedRefs },
  });
  refresh();
}

/** Registra o vencedor do desempate: por maioria ou voto de minerva do admin. */
export async function decideTiebreak(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await adminClient();
  if (!supabase) return NO_ACCESS;
  const tiebreakId = field(fd, "tiebreak_id");
  const winnerRef = field(fd, "winner_ref");
  if (!tiebreakId || !winnerRef) return { error: "Escolha o vencedor." };

  const data = await loadJuryData(supabase);
  const result = computeJuryResults(data).find((r) => r.tiebreak?.id === tiebreakId);
  const tb = result?.tiebreak;
  if (!tb) return { error: "Desempate não encontrado." };
  if (!tb.tiedRefs.includes(winnerRef)) return { error: "Esse candidato não está no empate." };

  const method = tb.majorityRef === winnerRef ? "majority" : "casting_vote";
  const { data: claims } = await supabase.auth.getClaims();

  const { error } = await supabase
    .from("tiebreaks")
    .update({
      status: "decided",
      winner_ref: winnerRef,
      method,
      decided_by: claims?.claims?.sub ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", tiebreakId);
  if (error) return { error: dbError(error) };

  await supabase.rpc("log_action", {
    p_action: "tiebreak.decide",
    p_entity: "tiebreaks",
    p_entity_id: tiebreakId,
    p_details: { winner: winnerRef, method, counts: tb.counts },
  });
  refresh();
  return { message: method === "majority" ? "Vencedor registrado pela maioria." : "Vencedor registrado (voto de minerva)." };
}

/** Desfaz a decisão ou cancela a rodada. */
export async function resetTiebreak(fd: FormData): Promise<void> {
  const supabase = await adminClient();
  const id = field(fd, "tiebreak_id");
  const mode = field(fd, "mode"); // "reopen" | "delete"
  if (!supabase || !id) return;

  if (mode === "delete") {
    await supabase.from("tiebreaks").delete().eq("id", id);
  } else {
    await supabase
      .from("tiebreaks")
      .update({ status: "open", winner_ref: null, method: null, decided_by: null, decided_at: null })
      .eq("id", id);
  }
  await supabase.rpc("log_action", { p_action: `tiebreak.${mode === "delete" ? "cancel" : "reopen"}`, p_entity: "tiebreaks", p_entity_id: id });
  refresh();
}
