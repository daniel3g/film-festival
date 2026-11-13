"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/form-status";
import { saveFilm } from "./actions";

type Ceremony = { id: string; name: string };
export type FilmFormValues = {
  id?: string;
  title?: string;
  ceremony_id?: string;
  class_name?: string | null;
  synopsis?: string | null;
  screening_order?: number;
  drive_file_id?: string | null;
};

export function FilmForm({ ceremonies, film }: { ceremonies: Ceremony[]; film?: FilmFormValues }) {
  const [state, action, pending] = useActionState(saveFilm, undefined);
  const driveLink = film?.drive_file_id ? `https://drive.google.com/file/d/${film.drive_file_id}/view` : "";

  return (
    <form action={action} className="space-y-5">
      {film?.id && <input type="hidden" name="id" value={film.id} />}

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">Título *</label>
          <input id="title" name="title" required className="input" defaultValue={film?.title ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="ceremony_id">Cerimônia *</label>
          <select id="ceremony_id" name="ceremony_id" required className="input" defaultValue={film?.ceremony_id ?? ""}>
            <option value="" disabled>Escolha…</option>
            {ceremonies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="class_name">Turma</label>
            <input id="class_name" name="class_name" placeholder="8th A" className="input" defaultValue={film?.class_name ?? ""} />
          </div>
          <div>
            <label className="label" htmlFor="screening_order">Ordem de exibição</label>
            <input id="screening_order" name="screening_order" type="number" min={0} className="input" defaultValue={film?.screening_order ?? 0} />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="synopsis">Sinopse</label>
          <textarea id="synopsis" name="synopsis" rows={4} className="input" defaultValue={film?.synopsis ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="drive_link">Link do vídeo no Google Drive</label>
          <input
            id="drive_link"
            name="drive_link"
            className="input"
            placeholder="https://drive.google.com/file/d/…/view?usp=sharing"
            defaultValue={driveLink}
          />
          <p className="mt-1 text-xs text-muted">
            No Drive: botão direito no vídeo → Compartilhar → &quot;Qualquer pessoa com o link&quot; → Copiar link.
          </p>
        </div>
      </div>

      <FormStatus state={state} />

      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Salvando…" : film?.id ? "Salvar alterações" : "Cadastrar filme"}
      </button>
    </form>
  );
}
