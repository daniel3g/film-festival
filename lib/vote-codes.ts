import "server-only";
import { createHash, randomBytes, randomInt } from "node:crypto";

/** Sem caracteres ambíguos (0/O, 1/I/L, 2/Z, 5/S, 8/B, 6/G…). docs/05 */
export const CODE_ALPHABET = "ACDEFHJKMNPRTUVWXY3479";
export const CODE_LENGTH = 4;
export const BATCH_SIZE = 30;
export const BATCHES = ["A", "B", "C", "D"] as const;
export type Batch = (typeof BATCHES)[number];

function pepper() {
  const p = process.env.VOTE_CODE_PEPPER;
  if (!p || p.length < 16) throw new Error("VOTE_CODE_PEPPER não configurado.");
  return p;
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

/** Hash do código do cartão (o código em si nunca é guardado). */
export function hashCode(code: string) {
  return sha256(`code:${pepper()}:${code}`);
}

/** Hash do token da urna e do código de pareamento. */
export function hashToken(token: string) {
  return sha256(`device:${pepper()}:${token}`);
}

export function newDeviceToken() {
  return randomBytes(32).toString("base64url");
}

/** Código de pareamento da urna: 8 caracteres (ex.: K7PX-3MHA), válido por 10 min. */
export function newPairingCode() {
  return `${randomCodeBody()}-${randomCodeBody()}`;
}

/** Normaliza o código de pareamento digitado na urna. */
export function normalizePairingCode(input: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 8 ? `${s.slice(0, 4)}-${s.slice(4)}` : null;
}

export function randomCodeBody() {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/**
 * Normaliza o que o aluno digitou: maiúsculas, sem espaços/traços.
 * Aceita "SR-K7PX", "sr k7px", "SRK7PX" ou só "K7PX" (usa o prefixo da urna).
 * Devolve null se não tiver formato de código.
 */
export function normalizeCode(input: string, defaultPrefix: string): string | null {
  const s = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!s) return null;
  let prefix: string;
  let body: string;
  if (s.length === CODE_LENGTH) {
    prefix = defaultPrefix;
    body = s;
  } else if (s.length > CODE_LENGTH && s.length <= CODE_LENGTH + 3) {
    prefix = s.slice(0, s.length - CODE_LENGTH);
    body = s.slice(-CODE_LENGTH);
  } else {
    return null;
  }
  if (!/^[A-Z]{2,3}$/.test(prefix)) return null;
  return `${prefix}-${body}`;
}
