"use client";

import { useActionState, useState } from "react";
import { FormStatus } from "@/components/form-status";
import { addJuror } from "./actions";

export function AddJurorForm({ domain }: { domain: string }) {
  const [state, action, pending] = useActionState(addJuror, undefined);

  // Limpa o formulário depois de cadastrar com sucesso.
  const [formKey, setFormKey] = useState(0);
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state?.message) setFormKey((k) => k + 1);
  }

  return (
    <div className="space-y-3">
      <form key={formKey} action={action} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div>
          <label className="label" htmlFor="email">E-mail da escola *</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder={`nome@${domain}`}
            className="input"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="label" htmlFor="name">Nome</label>
          <input id="name" name="name" placeholder="Como aparece no painel" className="input" />
        </div>
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Cadastrando…" : "Cadastrar jurado"}
        </button>
      </form>
      <FormStatus state={state} />
    </div>
  );
}
