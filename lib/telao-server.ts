import "server-only";
import type { SupabaseServer } from "@/lib/admin";
import { computeJuryResults, computePeoplesChoice, loadJuryData, type JuryData } from "@/lib/results";
import { juryAward, peoplesChoiceAward, type Award, type Cue, type Show, type ShowFilm, type ShowTrack } from "@/lib/telao";

const SIGNED_TTL = 12 * 3600; // o painel fica aberto a manhã inteira

const TIME_FMT = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

/** Tudo o que o painel do telão precisa para uma cerimônia (cliente do admin). */
export async function loadShow(supabase: SupabaseServer, ceremonyId: string): Promise<Show | null> {
  const [{ data: ceremony }, juryData, { data: pcCat }] = await Promise.all([
    supabase
      .from("ceremonies")
      .select(
        "id, name, short_name, voting_status, sort_order, edition_id, editions!inner(name, jury_status, is_active), films(id, title, class_name, poster_path, drive_file_id, video_key, size_bytes, duration_ms, screening_order)",
      )
      .eq("id", ceremonyId)
      .order("screening_order", { referencedTable: "films" })
      .maybeSingle(),
    loadJuryData(supabase),
    supabase.from("categories").select("name_en, name_pt, editions!inner(is_active)").eq("editions.is_active", true).eq("code", "pc").maybeSingle(),
  ]);
  if (!ceremony) return null;

  const [{ data: siblings }, { data: trackRows }] = await Promise.all([
    supabase.from("ceremonies").select("name, starts_at, sort_order").eq("edition_id", ceremony.edition_id).order("sort_order"),
    supabase.from("soundtrack_tracks").select("id, cue, ceremony_id, storage_path, file_name").eq("edition_id", ceremony.edition_id),
  ]);

  // URLs assinadas: pôsteres e faixas.
  const posterPaths = ceremony.films.map((f) => f.poster_path).filter((p): p is string => !!p);
  const posterUrls = await signAll(supabase, "posters", posterPaths);

  const films: ShowFilm[] = ceremony.films.map((f) => ({
    id: f.id,
    title: f.title,
    className: f.class_name,
    posterUrl: f.poster_path ? (posterUrls.get(f.poster_path) ?? null) : null,
    driveFileId: f.drive_file_id,
    hasVideo: !!f.video_key,
    sizeBytes: f.size_bytes,
    durationMs: f.duration_ms,
  }));

  const jury = computeJuryResults(juryData);
  const awards = jury.filter((r) => r.ceremonyId === ceremonyId).map((r) => juryAward(r, films, ceremonyId));

  const pcInfo = { en: pcCat?.name_en ?? "People's Choice", pt: pcCat?.name_pt ?? "Escolha do Público" };
  const pc =
    ceremony.voting_status === "closed" ? await loadPeoplesChoice(supabase, ceremonyId, juryData, films, pcInfo) : null;

  const next = (siblings ?? []).find((s) => s.sort_order > ceremony.sort_order) ?? null;

  return {
    ceremony: {
      id: ceremony.id,
      name: ceremony.name,
      shortName: ceremony.short_name,
      votingStatus: ceremony.voting_status,
    },
    editionName: ceremony.editions.name,
    juryClosed: ceremony.editions.jury_status === "closed",
    nextCeremony: next
      ? { name: next.name, startsAt: next.starts_at ? TIME_FMT.format(new Date(next.starts_at)) : null }
      : null,
    films,
    awards,
    pcInfo,
    pc,
    tracks: await effectiveTracks(supabase, trackRows ?? [], ceremonyId),
  };
}

/** Resultado do People's Choice (só depois de encerrada a votação: RLS). */
export async function loadPeoplesChoice(
  supabase: SupabaseServer,
  ceremonyId: string,
  juryData: JuryData,
  films: ShowFilm[],
  pcInfo: { en: string; pt: string },
): Promise<Award | null> {
  const cer = juryData.ceremonies.find((c) => c.id === ceremonyId);
  if (!cer) return null;
  const { data: votes, error } = await supabase.from("votes").select("film_id").eq("ceremony_id", ceremonyId);
  if (error) return null;
  const byFilm: Record<string, number> = {};
  for (const v of votes ?? []) byFilm[v.film_id] = (byFilm[v.film_id] ?? 0) + 1;
  const result = computePeoplesChoice(cer, byFilm, computeJuryResults(juryData));
  return peoplesChoiceAward(result, films, pcInfo, ceremonyId);
}

type TrackRow = { id: string; cue: Cue; ceremony_id: string | null; storage_path: string; file_name: string | null };

/** Uma faixa por momento: a da cerimônia vale mais que a da edição. */
async function effectiveTracks(supabase: SupabaseServer, rows: TrackRow[], ceremonyId: string): Promise<ShowTrack[]> {
  const byCue = new Map<Cue, TrackRow>();
  for (const r of rows) {
    if (r.ceremony_id && r.ceremony_id !== ceremonyId) continue;
    const cur = byCue.get(r.cue);
    if (!cur || (r.ceremony_id && !cur.ceremony_id)) byCue.set(r.cue, r);
  }
  const chosen = [...byCue.values()];
  const urls = await signAll(supabase, "soundtrack", chosen.map((r) => r.storage_path));
  return chosen.map((r) => ({ id: r.id, cue: r.cue, url: urls.get(r.storage_path) ?? null, fileName: r.file_name }));
}

async function signAll(supabase: SupabaseServer, bucket: string, paths: string[]) {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_TTL);
  data?.forEach((d) => d.signedUrl && d.path && map.set(d.path, d.signedUrl));
  return map;
}
