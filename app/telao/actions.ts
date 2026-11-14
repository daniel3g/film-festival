"use server";

import { adminClient, dbError } from "@/lib/admin";
import { loadShow } from "@/lib/telao-server";
import type { Award } from "@/lib/telao";

export type PcResult = { ok: true; pc: Award | null; status: "not_started" | "open" | "closed" } | { ok: false; error: string };

/**
 * Encerra a votação da cerimônia (ao avançar o telão para "Votação encerrada")
 * e devolve o resultado do People's Choice.
 */
export async function closeVotingFromTelao(ceremonyId: string): Promise<PcResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Sem permissão. Entre de novo como admin." };

  const { data: cer } = await supabase.from("ceremonies").select("voting_status").eq("id", ceremonyId).single();
  if (!cer) return { ok: false, error: "Cerimônia não encontrada." };

  if (cer.voting_status !== "closed") {
    const { error } = await supabase.from("ceremonies").update({ voting_status: "closed" }).eq("id", ceremonyId);
    if (error) return { ok: false, error: dbError(error) };
    await supabase.rpc("log_action", {
      p_action: "voting.close",
      p_entity: "ceremonies",
      p_entity_id: ceremonyId,
      p_details: { from: "telao" },
    });
  }
  return fetchPeoplesChoice(ceremonyId);
}

/** Resultado do People's Choice, se a votação já foi encerrada. */
export async function fetchPeoplesChoice(ceremonyId: string): Promise<PcResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: "Sem permissão. Entre de novo como admin." };
  const show = await loadShow(supabase, ceremonyId);
  if (!show) return { ok: false, error: "Cerimônia não encontrada." };
  return { ok: true, pc: show.pc, status: show.ceremony.votingStatus };
}
