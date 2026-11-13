"use client";

import { useActionState, useState } from "react";
import { FormStatus } from "@/components/form-status";
import { deleteCastMember, saveCastMember } from "../actions";

export type CastMember = {
  id: string;
  student_name: string;
  role_name: string | null;
  is_evaluated: boolean;
  acting_category: "actress" | "actor" | null;
};

/** Linha do elenco: edita um integrante existente ou adiciona um novo. */
export function CastForm({
  filmId,
  member,
  nextOrder,
}: {
  filmId: string;
  member?: CastMember;
  nextOrder?: number;
}) {
  const [state, action, pending] = useActionState(saveCastMember, undefined);
  const [evaluated, setEvaluated] = useState(member?.is_evaluated ?? false);
  const isNew = !member;

  // Formulário de novo integrante: limpa depois de salvar com sucesso.
  const [formKey, setFormKey] = useState(0);
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (isNew && state?.message) {
      setFormKey((k) => k + 1);
      setEvaluated(false);
    }
  }

  return (
    <div className="space-y-2">
      <form
        key={formKey}
        action={action}
        className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto_10rem_auto]"
      >
        <input type="hidden" name="film_id" value={filmId} />
        {member && <input type="hidden" name="id" value={member.id} />}
        {isNew && <input type="hidden" name="sort_order" value={nextOrder ?? 0} />}

        <div>
          {isNew && <label className="label">Aluno(a)</label>}
          <input
            name="student_name"
            required
            placeholder="Nome curto"
            className="input"
            defaultValue={member?.student_name ?? ""}
            aria-label="Nome do aluno"
          />
        </div>
        <div>
          {isNew && <label className="label">Personagem</label>}
          <input
            name="role_name"
            placeholder="Personagem"
            className="input"
            defaultValue={member?.role_name ?? ""}
            aria-label="Personagem"
          />
        </div>
        <label className="flex h-[38px] items-center gap-2 whitespace-nowrap text-sm">
          <input
            type="checkbox"
            name="is_evaluated"
            checked={evaluated}
            onChange={(e) => setEvaluated(e.target.checked)}
            className="h-4 w-4 accent-[var(--gold)]"
          />
          Avaliado
        </label>
        <select
          name="acting_category"
          className="input"
          disabled={!evaluated}
          defaultValue={member?.acting_category ?? ""}
          aria-label="Categoria de atuação"
        >
          <option value="">—</option>
          <option value="actress">Melhor Atriz</option>
          <option value="actor">Melhor Ator</option>
        </select>
        <div className="flex gap-2">
          <button type="submit" className={isNew ? "btn" : "btn-ghost"} disabled={pending}>
            {pending ? "…" : isNew ? "Adicionar" : "Salvar"}
          </button>
          {member && (
            <button
              type="submit"
              formAction={deleteCastMember}
              formNoValidate
              className="btn-danger"
              disabled={pending}
              onClick={(e) => {
                if (!window.confirm(`Remover ${member.student_name} do elenco? As notas de atuação dadas a ele(a) também serão apagadas.`)) {
                  e.preventDefault();
                }
              }}
            >
              Remover
            </button>
          )}
        </div>
      </form>
      <FormStatus state={state} />
    </div>
  );
}
