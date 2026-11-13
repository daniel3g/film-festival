import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Júri" };

export default async function JuriHome() {
  const supabase = await createClient();
  const { data: ceremonies } = await supabase
    .from("ceremonies")
    .select("id, name, sort_order, films(id, title, class_name, screening_order)")
    .order("sort_order")
    .order("screening_order", { referencedTable: "films" });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Filmes para avaliar</h1>
        <p className="mt-1 text-muted">Você avalia os filmes das 3 cerimônias. As notas são salvas automaticamente.</p>
      </div>
      {ceremonies?.map((c) => (
        <section key={c.id}>
          <h2 className="font-display text-xl text-gold">{c.name}</h2>
          {c.films.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Nenhum filme cadastrado ainda.</p>
          ) : (
            <ul className="mt-3 grid gap-3 md:grid-cols-2">
              {c.films.map((f) => (
                <li key={f.id} className="rounded-lg border border-gold/20 bg-panel p-4">
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted">{f.class_name}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
