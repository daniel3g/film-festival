import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { FilmForm } from "../film-form";
import { deleteFilm } from "../actions";
import { PosterUpload } from "./poster-upload";
import { CastForm } from "./cast-form";
import { FilmVideoPlayer } from "@/components/film-video-player";
import { VideoUpload } from "./video-upload";

export const metadata: Metadata = { title: "Editar filme" };

function formatDuration(ms: number | null) {
  if (!ms) return null;
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
}

export default async function FilmePage({ params, searchParams }: PageProps<"/admin/filmes/[id]">) {
  const { id } = await params;
  const { novo } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const [{ data: film }, { data: ceremonies }] = await Promise.all([
    supabase
      .from("films")
      .select("*, cast_members(id, student_name, role_name, is_evaluated, acting_category, sort_order)")
      .eq("id", id)
      .order("sort_order", { referencedTable: "cast_members" })
      .maybeSingle(),
    supabase
      .from("ceremonies")
      .select("id, name, editions!inner(is_active)")
      .eq("editions.is_active", true)
      .order("sort_order"),
  ]);
  if (!film) notFound();

  let posterUrl: string | null = null;
  if (film.poster_path) {
    const { data } = await supabase.storage.from("posters").createSignedUrl(film.poster_path, 3600);
    posterUrl = data?.signedUrl ?? null;
  }

  const cast = film.cast_members;
  const nextOrder = cast.reduce((max, m) => Math.max(max, m.sort_order), 0) + 1;
  const duration = formatDuration(film.duration_ms);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/filmes" className="text-sm text-muted hover:text-foreground">← Filmes</Link>
        <h1 className="mt-2 font-display text-3xl">{film.title}</h1>
        {novo && (
          <p className="mt-2 text-sm text-emerald-300">Filme cadastrado. Agora envie o pôster e monte o elenco.</p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <section className="card p-6">
          <h2 className="mb-4 font-display text-xl">Dados do filme</h2>
          <FilmForm ceremonies={ceremonies ?? []} film={film} />
        </section>
        <section className="card p-6">
          <h2 className="mb-4 font-display text-xl">Pôster</h2>
          <PosterUpload filmId={film.id} posterUrl={posterUrl} />
        </section>
      </div>

      <section className="card p-6">
        <h2 className="font-display text-xl">Vídeo</h2>
        <p className="mt-1 text-sm text-muted">
          {film.video_key ? (
            <span className="text-emerald-300">✓ Vídeo no servidor do festival.</span>
          ) : film.drive_file_id ? (
            <span className="text-amber-300">
              Vídeo só no Drive, que tem limite de downloads por arquivo. Envie o arquivo aqui para o júri e o telão
              usarem o servidor do festival.
            </span>
          ) : (
            <span className="text-amber-300">Sem vídeo. Envie o arquivo (MP4, de preferência).</span>
          )}
          {duration && <> · Duração: {duration}</>}
        </p>
        <div className="mt-4">
          <VideoUpload filmId={film.id} hasVideo={!!film.video_key} />
        </div>
        {(film.video_key || film.drive_file_id) && (
          <div className="mt-4 space-y-2">
            <p className="text-sm text-muted">É assim que o júri vai assistir:</p>
            <div className="aspect-video w-full max-w-3xl overflow-hidden rounded-md border border-gold/20 bg-black">
              <FilmVideoPlayer
                key={film.video_key ?? film.drive_file_id}
                filmId={film.id}
                hasVideo={!!film.video_key}
                driveFileId={film.drive_file_id}
                title={film.title}
              />
            </div>
          </div>
        )}
      </section>

      <section className="card space-y-4 p-6">
        <div>
          <h2 className="font-display text-xl">Elenco</h2>
          <p className="mt-1 text-sm text-muted">
            Use só o primeiro nome ou nome curto. Marque <strong>Avaliado</strong> para quem concorre a Melhor
            Atriz ou Melhor Ator: o júri dá nota a essas pessoas.
          </p>
        </div>
        {cast.length > 0 && (
          <div className="space-y-3">
            {cast.map((m) => (
              <CastForm key={m.id} filmId={film.id} member={m} />
            ))}
          </div>
        )}
        <div className="border-t border-gold/10 pt-4">
          <CastForm filmId={film.id} nextOrder={nextOrder} />
        </div>
      </section>

      <section className="rounded-lg border border-red-500/30 p-6">
        <h2 className="font-display text-xl text-red-300">Excluir filme</h2>
        <p className="mt-1 text-sm text-muted">Apaga o filme, o elenco, o pôster e todas as notas e votos dele.</p>
        <form action={deleteFilm} className="mt-4">
          <input type="hidden" name="id" value={film.id} />
          <ConfirmSubmit message={`Excluir "${film.title}"? Isso não pode ser desfeito.`}>Excluir filme</ConfirmSubmit>
        </form>
      </section>
    </div>
  );
}
