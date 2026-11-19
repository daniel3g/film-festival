"use server";

import { refresh } from "next/cache";
import { adminClient, dbError, field, type ActionState } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/server";
import {
  BATCHES,
  BATCH_SIZE,
  hashCode,
  hashToken,
  newPairingCode,
  randomCodeBody,
  suggestedBatches,
  type Batch,
} from "@/lib/vote-codes";

const NO_ACCESS = "Sem permissão. Entre de novo como admin.";

// ---------------------------------------------------------------- abrir / encerrar

export async function setVotingStatus(fd: FormData): Promise<void> {
  const supabase = await adminClient();
  const ceremonyId = field(fd, "ceremony_id");
  const status = field(fd, "status");
  if (!supabase || !ceremonyId || (status !== "open" && status !== "closed")) return;

  const { data: before } = await supabase.from("ceremonies").select("voting_status").eq("id", ceremonyId).single();
  if (!before || before.voting_status === status) return;

  const { error } = await supabase.from("ceremonies").update({ voting_status: status }).eq("id", ceremonyId);
  if (error) throw new Error(dbError(error));

  await supabase.rpc("log_action", {
    p_action: status === "open" ? (before.voting_status === "closed" ? "voting.reopen" : "voting.open") : "voting.close",
    p_entity: "ceremonies",
    p_entity_id: ceremonyId,
  });
  refresh();
}

// ---------------------------------------------------------------- zerar (testes)

export type ResetResult = { ok: true; votes: number; codes: number } | { ok: false; error: string };

/** Apaga votos e códigos da cerimônia e volta a votação para "não aberta". */
export async function resetVoting(ceremonyId: string): Promise<ResetResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: NO_ACCESS };
  const { data, error } = await supabase.rpc("reset_voting", { p_ceremony: ceremonyId });
  if (error) return { ok: false, error: dbError(error) };
  const r = data as { votes: number; codes: number };
  refresh();
  return { ok: true, votes: r.votes, codes: r.codes };
}

// ---------------------------------------------------------------- códigos

export type GeneratedBatch =
  | { ok: true; ceremonyName: string; batch: Batch; codes: string[] }
  | { ok: false; error: string };

/**
 * Gera um lote de 30 códigos. Os códigos em texto só existem nesta resposta
 * (para imprimir); o banco guarda só o hash. Gerar de novo substitui o lote,
 * desde que nenhum código dele tenha sido usado.
 */
export async function generateBatch(ceremonyId: string, batch: Batch): Promise<GeneratedBatch> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: NO_ACCESS };
  if (!BATCHES.includes(batch)) return { ok: false, error: "Lote inválido." };

  const { data: cer } = await supabase.from("ceremonies").select("id, name, code_prefix").eq("id", ceremonyId).single();
  if (!cer) return { ok: false, error: "Cerimônia não encontrada." };

  const r = await createBatch(supabase, cer, batch);
  if (r.ok) refresh();
  return r;
}

type CardGroup = { ceremonyName: string; shortName: string; batch: Batch; codes: string[] };
export type GeneratedAll = { ok: true; groups: CardGroup[] } | { ok: false; error: string };

/**
 * Gera de uma vez os lotes recomendados que faltam em todas as cerimônias da
 * edição ativa, para imprimir tudo num arquivo só. Lotes que já existem não
 * são tocados (os cartões deles podem já estar impressos).
 */
export async function generateAllCards(): Promise<GeneratedAll> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: NO_ACCESS };

  const { data: ceremonies } = await supabase
    .from("ceremonies")
    .select("id, name, short_name, code_prefix, editions!inner(is_active)")
    .eq("editions.is_active", true)
    .order("sort_order");
  if (!ceremonies?.length) return { ok: false, error: "Nenhuma cerimônia na edição ativa." };

  const { data: existing } = await createAdminClient().from("vote_codes").select("ceremony_id, batch");
  const groups: CardGroup[] = [];
  for (const cer of ceremonies) {
    const have = new Set((existing ?? []).filter((k) => k.ceremony_id === cer.id).map((k) => k.batch));
    for (const batch of BATCHES.slice(0, suggestedBatches(cer.code_prefix))) {
      if (have.has(batch)) continue;
      let r = await createBatch(supabase, cer, batch);
      if (!r.ok && r.error.startsWith("Colisão")) r = await createBatch(supabase, cer, batch);
      if (!r.ok) {
        refresh();
        // Os lotes já gerados nesta chamada valem: mostra-os para imprimir mesmo assim.
        if (groups.length) return { ok: true, groups };
        return { ok: false, error: r.error };
      }
      groups.push({ ceremonyName: cer.name, shortName: cer.short_name, batch, codes: r.codes });
    }
  }
  refresh();
  if (!groups.length) return { ok: false, error: "Todos os lotes recomendados já foram gerados." };
  return { ok: true, groups };
}

async function createBatch(
  supabase: NonNullable<Awaited<ReturnType<typeof adminClient>>>,
  cer: { id: string; name: string; code_prefix: string },
  batch: Batch,
): Promise<GeneratedBatch> {
  const ceremonyId = cer.id;
  const service = createAdminClient();
  const { data: existing } = await service
    .from("vote_codes")
    .select("id, used_at")
    .eq("ceremony_id", ceremonyId)
    .eq("batch", batch);
  if (existing?.some((c) => c.used_at)) {
    return { ok: false, error: `O lote ${batch} já tem códigos usados e não pode ser gerado de novo.` };
  }

  // Códigos únicos (também entre cerimônias, pelo hash único no banco).
  const codes = new Set<string>();
  while (codes.size < BATCH_SIZE) codes.add(`${cer.code_prefix}-${randomCodeBody()}`);
  const list = [...codes];

  if (existing?.length) {
    const { error } = await service.from("vote_codes").delete().eq("ceremony_id", ceremonyId).eq("batch", batch);
    if (error) return { ok: false, error: dbError(error) };
  }
  const { error } = await service
    .from("vote_codes")
    .insert(list.map((code) => ({ ceremony_id: ceremonyId, batch, code_hash: hashCode(code) })));
  if (error) {
    // Colisão rara com código já existente: pede para tentar de novo.
    return { ok: false, error: error.code === "23505" ? "Colisão de código. Clique de novo para gerar." : dbError(error) };
  }

  await supabase.rpc("log_action", {
    p_action: existing?.length ? "codes.regenerate" : "codes.generate",
    p_entity: "ceremonies",
    p_entity_id: ceremonyId,
    p_details: { batch, count: list.length },
  });
  return { ok: true, ceremonyName: cer.name, batch, codes: list.sort() };
}

// ---------------------------------------------------------------- urnas

export type PairingResult = { ok: true; label: string; code: string; expiresAt: string } | { ok: false; error: string };

async function issuePairingCode(deviceId: string): Promise<PairingResult> {
  const supabase = await adminClient();
  if (!supabase) return { ok: false, error: NO_ACCESS };
  const code = newPairingCode();
  const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("devices")
    .update({ pairing_code_hash: hashToken(`pair:${code}`), pairing_expires_at: expiresAt })
    .eq("id", deviceId)
    .select("label")
    .single();
  if (error) return { ok: false, error: dbError(error) };
  refresh();
  return { ok: true, label: data.label, code, expiresAt };
}

export async function createDevice(_prev: ActionState, fd: FormData): Promise<ActionState & { pairing?: PairingResult }> {
  const supabase = await adminClient();
  if (!supabase) return { error: NO_ACCESS };
  const label = field(fd, "label");
  const ceremonyId = field(fd, "ceremony_id");
  if (!label) return { error: "Dê um nome à urna (ex.: Urna 1)." };

  const { data, error } = await supabase
    .from("devices")
    .insert({ label, ceremony_id: ceremonyId })
    .select("id")
    .single();
  if (error) return { error: dbError(error) };

  await supabase.rpc("log_action", { p_action: "device.create", p_entity: "devices", p_entity_id: data.id, p_details: { label } });
  const pairing = await issuePairingCode(data.id);
  return { message: `${label} criada.`, pairing };
}

export async function renewPairing(deviceId: string): Promise<PairingResult> {
  return issuePairingCode(deviceId);
}

export async function setDeviceCeremony(fd: FormData): Promise<void> {
  const supabase = await adminClient();
  const id = field(fd, "id");
  if (!supabase || !id) return;
  const ceremonyId = field(fd, "ceremony_id");
  const { error } = await supabase.from("devices").update({ ceremony_id: ceremonyId }).eq("id", id);
  if (error) throw new Error(dbError(error));
  await supabase.rpc("log_action", { p_action: "device.ceremony", p_entity: "devices", p_entity_id: id, p_details: { ceremony_id: ceremonyId } });
  refresh();
}

export async function revokeDevice(fd: FormData): Promise<void> {
  const supabase = await adminClient();
  const id = field(fd, "id");
  if (!supabase || !id) return;
  const { error } = await supabase
    .from("devices")
    .update({ revoked_at: new Date().toISOString(), token_hash: null, pairing_code_hash: null, pairing_expires_at: null })
    .eq("id", id);
  if (error) throw new Error(dbError(error));
  await supabase.rpc("log_action", { p_action: "device.revoke", p_entity: "devices", p_entity_id: id });
  refresh();
}

export async function deleteDevice(fd: FormData): Promise<void> {
  const supabase = await adminClient();
  const id = field(fd, "id");
  if (!supabase || !id) return;
  await supabase.from("devices").delete().eq("id", id).not("revoked_at", "is", null);
  refresh();
}
