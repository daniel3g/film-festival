import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Filmes" };

export default async function FilmesPage() {
  const supabase = await createClient();
  const { data: ceremonies } = await supabase
    .from("ceremonies")
    .select(
      "id, name, sort_order, editions!inner(is_active), films(id, title, class_name, screening_order, poster_path, drive_file_id, cast_members(is_evaluated))",
    )
    .eq("editions.is_active", true)
    .order("sort_order")
    .order("screening_order", { referencedTable: "films" });

  // URLs temporárias dos pôsteres (bucket privado).
  const paths = ceremonies?.flatMap((c) => c.films.map((f) => f.poster_path).filter((p): p is string => !!p)) ?? [];
  const posterUrls = new Map<string, string>();
  if (paths.length) {
    const { data } = await supabase.storage.from("posters").createSignedUrls(paths, 3600);
    data?.forEach((d) => d.signedUrl && d.path && posterUrls.set(d.path, d.signedUrl));
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Filmes</h1>
          <p className="mt-1 text-muted">Cadastro dos filmes, pôsteres, vídeos e elenco.</p>
        </div>
        <Link href="/admin/filmes/novo" className="btn">+ Novo filme</Link>
      </div>

      {ceremonies?.map((c) => (
        <section key={c.id}>
          <h2 className="font-display text-xl text-gold">{c.name}</h2>
          {c.films.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhum filme cadastrado.</p>
          ) : (
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.films.map((f) => {
                const poster = f.poster_path ? posterUrls.get(f.poster_path) : undefined;
                const evaluated = f.cast_members.filter((m) => m.is_evaluated).length;
                return (
                  <li key={f.id}>
                    <Link href={`/admin/filmes/${f.id}`} className="card flex gap-4 p-3 transition hover:border-gold/50">
                      <div className="flex h-24 w-16 shrink-0 items-center justify-center overflow-hidden rounded bg-background text-[10px] text-muted">
                        {poster ? (
                          // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
                          <img src={poster} alt="" className="h-full w-full object-cover" />
                        ) : (
                          "sem pôster"
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-muted">#{f.screening_order} · {f.class_name ?? "turma?"}</p>
                        <p className="truncate font-medium">{f.title}</p>
                        <ul className="mt-2 space-y-0.5 text-xs">
                          <li className={f.drive_file_id ? "text-emerald-300" : "text-amber-300"}>
                            {f.drive_file_id ? "✓ vídeo" : "• falta o vídeo"}
                          </li>
                          <li className={evaluated ? "text-emerald-300" : "text-amber-300"}>
                            {evaluated ? `✓ ${evaluated} avaliado(s) no elenco` : "• elenco avaliado vazio"}
                          </li>
                        </ul>
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
