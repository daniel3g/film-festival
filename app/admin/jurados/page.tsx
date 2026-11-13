import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getActiveEdition } from "@/lib/admin";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { AddJurorForm } from "./juror-forms";
import { removeJuror } from "./actions";

export const metadata: Metadata = { title: "Jurados" };

export default async function JuradosPage() {
  const supabase = await createClient();
  const edition = await getActiveEdition(supabase);
  if (!edition) return <p className="text-muted">Nenhuma edição ativa.</p>;

  const { data: jurors } = await supabase
    .from("jurors")
    .select("id, email, name, user_id, created_at, scores(count)")
    .eq("edition_id", edition.id)
    .order("created_at");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Jurados</h1>
        <p className="mt-1 text-muted">
          Cadastre o e-mail <strong>@{edition.juror_email_domain}</strong> de cada jurado. Ele(a) entra em{" "}
          <span className="text-foreground">/entrar</span> com o Google da escola e já vê os filmes.
        </p>
      </div>

      <section className="card p-6">
        <AddJurorForm domain={edition.juror_email_domain} />
      </section>

      <section className="card overflow-x-auto">
        {!jurors?.length ? (
          <p className="p-6 text-sm text-muted">Nenhum jurado cadastrado ainda.</p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gold/15 text-muted">
              <tr>
                <th className="px-4 py-3 font-normal">Jurado</th>
                <th className="px-4 py-3 font-normal">Primeiro acesso</th>
                <th className="px-4 py-3 font-normal">Notas dadas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {jurors.map((j) => (
                <tr key={j.id} className="border-b border-gold/10 last:border-0">
                  <td className="px-4 py-3">
                    <p>{j.name ?? "—"}</p>
                    <p className="text-xs text-muted">{j.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    {j.user_id ? <span className="text-emerald-300">✓ já entrou</span> : <span className="text-muted">ainda não</span>}
                  </td>
                  <td className="px-4 py-3">{j.scores[0]?.count ?? 0}</td>
                  <td className="px-4 py-3 text-right">
                    <form action={removeJuror}>
                      <input type="hidden" name="id" value={j.id} />
                      <ConfirmSubmit
                        className="btn-danger px-3 py-1"
                        message={`Remover ${j.email}? As notas dadas por esse jurado também serão apagadas.`}
                      >
                        Remover
                      </ConfirmSubmit>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
