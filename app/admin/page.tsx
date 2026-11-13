import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Admin" };

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminHome() {
  const supabase = await createClient();
  const { data: edition } = await supabase
    .from("editions")
    .select("id, name, event_date, venue, jury_status, ceremonies(id, name, starts_at, ends_at, audience, code_prefix, sort_order, films(count))")
    .eq("is_active", true)
    .order("sort_order", { referencedTable: "ceremonies" })
    .maybeSingle();

  const { count: jurorCount } = edition
    ? await supabase.from("jurors").select("id", { count: "exact", head: true }).eq("edition_id", edition.id)
    : { count: 0 };

  if (!edition) {
    return <p className="text-muted">Nenhuma edição ativa.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Edição ativa</p>
        <h1 className="mt-1 font-display text-3xl">{edition.name}</h1>
        <p className="mt-1 text-muted">
          {edition.event_date?.split("-").reverse().join("/")} · {edition.venue} · Júri{" "}
          {edition.jury_status === "open" ? "aberto" : "encerrado"} · {jurorCount ?? 0} jurado(s)
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-3">
        {edition.ceremonies.map((c) => (
          <article key={c.id} className="rounded-lg border border-gold/20 bg-panel p-5">
            <p className="text-xs text-gold">{c.code_prefix}</p>
            <h2 className="mt-1 font-display text-xl">{c.name}</h2>
            <p className="mt-2 text-sm text-muted">
              {c.starts_at && DATE_FMT.format(new Date(c.starts_at))}–{c.ends_at && DATE_FMT.format(new Date(c.ends_at))} · {c.audience}
            </p>
            <p className="mt-3 text-sm">{c.films[0]?.count ?? 0} filme(s) cadastrado(s)</p>
          </article>
        ))}
      </section>

      <p className="text-sm text-muted">
        Próximo passo do desenvolvimento: telas de cadastro de filmes, elenco e jurados.
      </p>
    </div>
  );
}
