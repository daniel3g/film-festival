import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { FilmForm } from "../film-form";

export const metadata: Metadata = { title: "Novo filme" };

export default async function NovoFilmePage({ searchParams }: PageProps<"/admin/filmes/novo">) {
  const { cerimonia } = await searchParams;
  const supabase = await createClient();
  const { data: ceremonies } = await supabase
    .from("ceremonies")
    .select("id, name, editions!inner(is_active)")
    .eq("editions.is_active", true)
    .order("sort_order");

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/admin/filmes" className="text-sm text-muted hover:text-foreground">← Filmes</Link>
      <h1 className="font-display text-3xl">Novo filme</h1>
      <p className="text-sm text-muted">Depois de cadastrar, você envia o pôster e monta o elenco.</p>
      <div className="card p-6">
        <FilmForm
          ceremonies={ceremonies ?? []}
          film={typeof cerimonia === "string" ? { ceremony_id: cerimonia } : undefined}
        />
      </div>
    </div>
  );
}
