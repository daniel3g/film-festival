import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/server";
import { hashToken } from "@/lib/vote-codes";

export const URNA_COOKIE = "urna_token";

export type UrnaDevice = {
  id: string;
  label: string;
  tokenHash: string;
  ceremony: { id: string; name: string; short_name: string; code_prefix: string; voting_status: "not_started" | "open" | "closed" } | null;
};

/**
 * Hash do token da urna, só pelo cookie (sem consultar o banco).
 * As funções SQL check_code/cast_vote já identificam e validam a urna por ele.
 */
export async function getUrnaTokenHash(): Promise<string | null> {
  const token = (await cookies()).get(URNA_COOKIE)?.value;
  return token ? hashToken(token) : null;
}

/** Urna pareada deste navegador (pelo cookie), ou null. */
export async function getUrnaDevice(): Promise<UrnaDevice | null> {
  const token = (await cookies()).get(URNA_COOKIE)?.value;
  if (!token) return null;
  const tokenHash = hashToken(token);

  const { data } = await createAdminClient()
    .from("devices")
    .select("id, label, ceremonies(id, name, short_name, code_prefix, voting_status)")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, label: data.label, tokenHash, ceremony: data.ceremonies };
}

export type BallotFilm = { id: string; title: string; class_name: string | null; posterUrl: string | null };

/** Filmes da cerimônia da urna, com pôster (URL assinada de 6 h). */
export async function getBallot(ceremonyId: string): Promise<BallotFilm[]> {
  const service = createAdminClient();
  const { data: films } = await service
    .from("films")
    .select("id, title, class_name, poster_path, screening_order")
    .eq("ceremony_id", ceremonyId)
    .order("screening_order");
  const paths = (films ?? []).map((f) => f.poster_path).filter((p): p is string => !!p);
  const urls = new Map<string, string>();
  if (paths.length) {
    const { data } = await service.storage.from("posters").createSignedUrls(paths, 6 * 3600);
    data?.forEach((d) => d.signedUrl && d.path && urls.set(d.path, d.signedUrl));
  }
  return (films ?? []).map((f) => ({
    id: f.id,
    title: f.title,
    class_name: f.class_name,
    posterUrl: f.poster_path ? (urls.get(f.poster_path) ?? null) : null,
  }));
}
