"use client";

import { useActionState } from "react";
import { FormStatus } from "@/components/form-status";
import { decideTiebreak } from "./actions";

export function DecideForm({
  tiebreakId,
  options,
  majorityRef,
}: {
  tiebreakId: string;
  options: { ref: string; label: string; votes: number }[];
  majorityRef: string | null;
}) {
  const [state, action, pending] = useActionState(decideTiebreak, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tiebreak_id" value={tiebreakId} />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm text-muted">
          {majorityRef
            ? "Há maioria. Confirme o vencedor (ou escolha outro como voto de minerva):"
            : "Sem maioria. Escolha o vencedor (voto de minerva):"}
        </legend>
        {options.map((o) => (
          <label key={o.ref} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="winner_ref"
              value={o.ref}
              defaultChecked={o.ref === majorityRef}
              className="accent-[var(--gold)]"
              required
            />
            {o.label} <span className="text-muted">({o.votes} voto{o.votes === 1 ? "" : "s"})</span>
          </label>
        ))}
      </fieldset>
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Registrando…" : "Registrar vencedor"}
      </button>
      <FormStatus state={state} />
    </form>
  );
}
