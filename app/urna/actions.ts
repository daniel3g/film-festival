"use server";

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { getBallot, getUrnaDevice, URNA_COOKIE, type BallotFilm } from "@/lib/urna";
import { hashCode, hashToken, newDeviceToken, normalizeCode, normalizePairingCode } from "@/lib/vote-codes";

// ---------------------------------------------------------------- pareamento

export async function pairUrna(input: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const code = normalizePairingCode(input);
  if (!code) return { ok: false, error: "O código de pareamento tem 8 caracteres (ex.: K7PX-3MHA)." };

  const service = createAdminClient();
  const token = newDeviceToken();
  const { data } = await service
    .from("devices")
    .update({
      token_hash: hashToken(token),
      pairing_code_hash: null,
      pairing_expires_at: null,
      failed_attempts: 0,
      locked_until: null,
      last_seen_at: new Date().toISOString(),
    })
    .eq("pairing_code_hash", hashToken(`pair:${code}`))
    .gt("pairing_expires_at", new Date().toISOString())
    .is("revoked_at", null)
    .select("id")
    .maybeSingle();

  if (!data) return { ok: false, error: "Código inválido ou expirado. Gere um novo no painel do admin." };

  (await cookies()).set(URNA_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 3600,
  });
  return { ok: true };
}

// ---------------------------------------------------------------- estado

export type UrnaState =
  | { paired: false }
  | {
      paired: true;
      label: string;
      ceremony: { id: string; name: string; prefix: string; status: "not_started" | "open" | "closed" } | null;
    };

export async function getUrnaState(): Promise<UrnaState> {
  const device = await getUrnaDevice();
  if (!device) return { paired: false };
  return {
    paired: true,
    label: device.label,
    ceremony: device.ceremony
      ? { id: device.ceremony.id, name: device.ceremony.name, prefix: device.ceremony.code_prefix, status: device.ceremony.voting_status }
      : null,
  };
}

export async function loadBallot(): Promise<BallotFilm[]> {
  const device = await getUrnaDevice();
  if (!device?.ceremony) return [];
  return getBallot(device.ceremony.id);
}

// ---------------------------------------------------------------- voto

export type VoteStep =
  | { ok: true; code: string }
  | { ok: false; reason: string; message: string };

const MESSAGES: Record<string, string> = {
  no_device: "Esta urna não está pareada. Chame a organização.",
  locked: "Muitos códigos errados. Aguarde alguns segundos e tente de novo.",
  closed: "A votação não está aberta agora.",
  invalid: "Código não encontrado. Confira o cartão e digite de novo.",
  used: "Este código já foi usado.",
  invalid_film: "Filme inválido. Escolha de novo.",
  format: "Digite o código do cartão (ex.: SR-K7PX).",
};

async function otherCeremonyMessage(code: string) {
  const prefix = code.split("-")[0];
  const { data } = await createAdminClient()
    .from("ceremonies")
    .select("name, editions!inner(is_active)")
    .eq("code_prefix", prefix)
    .eq("editions.is_active", true)
    .maybeSingle();
  return data
    ? `Este cartão é da cerimônia "${data.name}". Ele só vale nela.`
    : "Este cartão é de outra cerimônia.";
}

/** Passo 1: confere o código e libera a cédula (não gasta o código). */
export async function checkVoteCode(input: string): Promise<VoteStep> {
  const device = await getUrnaDevice();
  if (!device?.ceremony) return { ok: false, reason: "no_device", message: MESSAGES.no_device };

  const code = normalizeCode(input, device.ceremony.code_prefix);
  if (!code) return { ok: false, reason: "format", message: MESSAGES.format };

  const { data, error } = await createAdminClient().rpc("check_code", {
    p_token_hash: device.tokenHash,
    p_code_hash: hashCode(code),
  });
  if (error) return { ok: false, reason: "error", message: "Falha de conexão. Tente de novo." };
  if (data === "ok") return { ok: true, code };
  if (data === "other_ceremony") return { ok: false, reason: data, message: await otherCeremonyMessage(code) };
  return { ok: false, reason: data, message: MESSAGES[data] ?? "Não foi possível conferir o código." };
}

/** Passo 2: registra o voto (gasta o código na mesma operação). */
export async function castVote(code: string, filmId: string): Promise<VoteStep> {
  const device = await getUrnaDevice();
  if (!device?.ceremony) return { ok: false, reason: "no_device", message: MESSAGES.no_device };

  const normalized = normalizeCode(code, device.ceremony.code_prefix);
  if (!normalized) return { ok: false, reason: "format", message: MESSAGES.format };

  const { data, error } = await createAdminClient().rpc("cast_vote", {
    p_token_hash: device.tokenHash,
    p_code_hash: hashCode(normalized),
    p_film: filmId,
  });
  if (error) return { ok: false, reason: "error", message: "Falha de conexão. Tente de novo." };
  if (data === "ok") return { ok: true, code: normalized };
  if (data === "other_ceremony") return { ok: false, reason: data, message: await otherCeremonyMessage(normalized) };
  return { ok: false, reason: data, message: MESSAGES[data] ?? "Não foi possível registrar o voto." };
}
