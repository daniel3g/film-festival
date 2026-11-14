import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getActiveEdition } from "@/lib/admin";
import type { Cue } from "@/lib/telao";
import { DownloadPanel, type DlCeremony, type DlTrack } from "./download-panel";
import { SoundtrackPanel } from "./soundtrack-panel";

export const metadata: Metadata = { title: "Telão" };

export default async function AdminTelaoPage() {
  const supabase = await createClient();
  const edition = await getActiveEdition(supabase);
  if (!edition) return <p className="text-muted">Nenhuma edição ativa.</p>;

  const [{ data: ceremonies }, { data: tracks }] = await Promise.all([
    supabase
      .from("ceremonies")
      .select("id, name, sort_order, films(id, title, drive_file_id, size_bytes, duration_ms, poster_path, screening_order)")
      .eq("edition_id", edition.id)
      .order("sort_order")
      .order("screening_order", { referencedTable: "films" }),
    supabase
      .from("soundtrack_tracks")
      .select("id, cue, storage_path, file_name, size_bytes")
      .eq("edition_id", edition.id)
      .is("ceremony_id", null),
  ]);

  const posterPaths = (ceremonies ?? []).flatMap((c) => c.films.map((f) => f.poster_path)).filter((p): p is string => !!p);
  const trackPaths = (tracks ?? []).map((t) => t.storage_path);
  const [posters, trackUrls] = await Promise.all([sign(supabase, "posters", posterPaths), sign(supabase, "soundtrack", trackPaths)]);

  const dlCeremonies: DlCeremony[] = (ceremonies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    films: c.films.map((f) => ({
      id: f.id,
      title: f.title,
      driveFileId: f.drive_file_id,
      sizeBytes: f.size_bytes,
      durationMs: f.duration_ms,
      posterUrl: f.poster_path ? (posters.get(f.poster_path) ?? null) : null,
    })),
  }));
  const dlTracks: DlTrack[] = (tracks ?? []).map((t) => ({
    id: t.id,
    cue: t.cue as Cue,
    url: trackUrls.get(t.storage_path) ?? null,
    fileName: t.file_name,
    sizeBytes: t.size_bytes,
  }));

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Telão</h1>
        <p className="mt-1 text-muted">
          Na véspera, baixe os filmes <strong>no notebook que vai para o telão</strong>, no Chrome. No dia, eles tocam do
          disco, sem depender da internet.
        </p>
      </div>

      <DownloadPanel ceremonies={dlCeremonies} tracks={dlTracks} />

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="font-display text-xl">Trilha sonora</h2>
          <p className="mt-1 text-sm text-muted">
            A mesma trilha nas 3 cerimônias. Sem arquivo, toca um exemplo clássico gerado pelo próprio navegador. Para
            trocar, envie um MP3 (até 30 MB) livre de direitos autorais, por exemplo da Pixabay Music ou da YouTube Audio
            Library. Depois de trocar, baixe de novo no notebook do telão.
          </p>
        </div>
        <SoundtrackPanel editionId={edition.id} tracks={dlTracks} />
      </section>
    </div>
  );
}

async function sign(supabase: Awaited<ReturnType<typeof createClient>>, bucket: string, paths: string[]) {
  const map = new Map<string, string>();
  if (!paths.length) return map;
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, 6 * 3600);
  data?.forEach((d) => d.signedUrl && d.path && map.set(d.path, d.signedUrl));
  return map;
}
