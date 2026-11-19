import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getJuryCategories, scoreItemsFor, scoreKey } from "@/lib/jury";
import { FilmVideoPlayer } from "@/components/film-video-player";
import { ScorePanel } from "./score-panel";

export const metadata: Metadata = { title: "Avaliar filme" };

export default async function JuriFilmePage({ params }: PageProps<"/juri/filmes/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: film }, categories, { data: myScores }, { data: allFilms }, { data: edition }] = await Promise.all([
    supabase
      .from("films")
      .select("id, title, class_name, synopsis, drive_file_id, video_key, ceremonies(name), cast_members(id, student_name, role_name, is_evaluated, acting_category, sort_order)")
      .eq("id", id)
      .order("sort_order", { referencedTable: "cast_members" })
      .maybeSingle(),
    getJuryCategories(supabase),
    supabase.from("scores").select("category_id, cast_member_id, value").eq("film_id", id),
    supabase
      .from("films")
      .select("id, title, screening_order, ceremonies!inner(sort_order)")
      .order("sort_order", { referencedTable: "ceremonies" })
      .order("screening_order"),
    supabase.from("editions").select("jury_status").eq("is_active", true).maybeSingle(),
  ]);
  if (!film) notFound();

  const items = scoreItemsFor(categories, film.cast_members);
  const initial: Record<string, number> = {};
  for (const s of myScores ?? []) initial[scoreKey(s.category_id, s.cast_member_id)] = Number(s.value);

  // Anterior / próximo na ordem das cerimônias.
  const ordered = (allFilms ?? []).sort(
    (a, b) => a.ceremonies.sort_order - b.ceremonies.sort_order || a.screening_order - b.screening_order,
  );
  const idx = ordered.findIndex((f) => f.id === film.id);
  const prev = idx > 0 ? ordered[idx - 1] : null;
  const next = idx >= 0 && idx < ordered.length - 1 ? ordered[idx + 1] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <Link href="/juri" className="text-muted hover:text-foreground">← Todos os filmes</Link>
        <div className="flex gap-2">
          {prev && <Link href={`/juri/filmes/${prev.id}`} className="btn-ghost px-3 py-1">← {prev.title}</Link>}
          {next && <Link href={`/juri/filmes/${next.id}`} className="btn-ghost px-3 py-1">{next.title} →</Link>}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">{film.ceremonies?.name}</p>
        <h1 className="mt-1 font-display text-3xl">{film.title}</h1>
        {film.class_name && <p className="text-muted">{film.class_name}</p>}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-4">
          <div className="aspect-video w-full overflow-hidden rounded-lg border border-gold/20 bg-black">
            {film.video_key || film.drive_file_id ? (
              <FilmVideoPlayer
                filmId={film.id}
                hasVideo={!!film.video_key}
                driveFileId={film.drive_file_id}
                title={film.title}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted">
                O vídeo deste filme ainda não foi enviado pela organização.
              </div>
            )}
          </div>
          {film.synopsis && (
            <div className="card p-4">
              <h2 className="text-xs uppercase tracking-[0.2em] text-gold">Sinopse</h2>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{film.synopsis}</p>
            </div>
          )}
          <p className="text-xs text-muted">
            Notas de 0 a 10, com meio ponto. Cada nota é salva assim que você escolhe, e pode ser alterada até a
            organização encerrar a avaliação.
          </p>
        </div>

        <aside className="card h-fit p-5 lg:sticky lg:top-4">
          <h2 className="mb-4 font-display text-xl">Suas notas</h2>
          <ScorePanel
            filmId={film.id}
            items={items}
            initial={initial}
            readOnly={edition?.jury_status === "closed"}
          />
        </aside>
      </div>
    </div>
  );
}
