import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getJuryCategories, scoreItemsFor } from "@/lib/jury";

export const metadata: Metadata = { title: "Júri" };

export default async function JuriHome() {
  const supabase = await createClient();
  const [{ data: ceremonies }, categories, { data: myScores }, { data: edition }] = await Promise.all([
    supabase
      .from("ceremonies")
      .select("id, name, sort_order, films(id, title, class_name, screening_order, poster_path, drive_file_id, cast_members(id, student_name, role_name, is_evaluated, acting_category))")
      .order("sort_order")
      .order("screening_order", { referencedTable: "films" }),
    getJuryCategories(supabase),
    supabase.from("scores").select("film_id"),
    supabase.from("editions").select("jury_status").eq("is_active", true).maybeSingle(),
  ]);

  const scoredByFilm = new Map<string, number>();
  for (const s of myScores ?? []) scoredByFilm.set(s.film_id, (scoredByFilm.get(s.film_id) ?? 0) + 1);

  const paths = ceremonies?.flatMap((c) => c.films.map((f) => f.poster_path).filter((p): p is string => !!p)) ?? [];
  const posterUrls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("posters").createSignedUrls(paths, 3600);
    data?.forEach((d) => d.signedUrl && d.path && posterUrls.set(d.path, d.signedUrl));
  }

  let total = 0;
  let done = 0;
  const cards = ceremonies?.map((c) => ({
    ...c,
    films: c.films.map((f) => {
      const expected = scoreItemsFor(categories, f.cast_members).length;
      const given = Math.min(scoredByFilm.get(f.id) ?? 0, expected);
      total += expected;
      done += given;
      return { ...f, expected, given };
    }),
  }));

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Filmes para avaliar</h1>
          <p className="mt-1 text-muted">
            Você avalia os filmes das 3 cerimônias. As notas são salvas automaticamente.
          </p>
        </div>
        {total > 0 && (
          <p className="text-sm">
            <span className="font-display text-2xl text-gold">{done}</span>
            <span className="text-muted"> / {total} notas</span>
          </p>
        )}
      </div>

      {edition?.jury_status === "closed" && (
        <p className="rounded-md border border-gold/30 bg-gold/10 p-3 text-sm">
          A avaliação foi encerrada. Obrigado! As notas estão disponíveis só para consulta.
        </p>
      )}

      {cards?.map((c) => (
        <section key={c.id}>
          <h2 className="font-display text-xl text-gold">{c.name}</h2>
          {c.films.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhum filme cadastrado ainda.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.films.map((f) => {
                const poster = f.poster_path ? posterUrls.get(f.poster_path) : undefined;
                const complete = f.expected > 0 && f.given >= f.expected;
                return (
                  <li key={f.id}>
                    <Link href={`/juri/filmes/${f.id}`} className="card flex gap-4 p-3 transition hover:border-gold/50">
                      <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-background text-[10px] text-muted">
                        {poster ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
                          <img src={poster} alt="" className="h-full w-full object-cover" />
                        ) : (
                          "🎬"
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.title}</p>
                        <p className="text-xs text-muted">{f.class_name}</p>
                        <p className={`mt-2 text-xs ${complete ? "text-emerald-300" : f.given ? "text-amber-300" : "text-muted"}`}>
                          {complete ? "✓ avaliado" : `${f.given} de ${f.expected} notas`}
                        </p>
                        {!f.drive_file_id && <p className="text-xs text-muted">vídeo em breve</p>}
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
