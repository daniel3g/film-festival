"use client";

import { useState, useTransition } from "react";
import { voteTiebreak } from "./actions";

export function TiebreakVote({
  tiebreakId,
  title,
  options,
  initialChoice,
}: {
  tiebreakId: string;
  title: string;
  options: { ref: string; label: string; sublabel: string }[];
  initialChoice: string | null;
}) {
  const [choice, setChoice] = useState(initialChoice);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(ref: string) {
    const previous = choice;
    setChoice(ref);
    setError(null);
    startTransition(async () => {
      let result;
      try {
        result = await voteTiebreak(tiebreakId, ref);
      } catch {
        result = { ok: false as const, error: "Sem conexão. Tente de novo." };
      }
      if (!result.ok) {
        setChoice(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="card space-y-3 border-gold/50 p-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-gold">Desempate</p>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted">Houve empate no 1º lugar. Escolha quem deve vencer:</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <button
            key={o.ref}
            type="button"
            disabled={pending}
            onClick={() => choose(o.ref)}
            className={`rounded-md border p-3 text-left transition ${
              choice === o.ref ? "border-gold bg-gold/15" : "border-gold/20 hover:border-gold/50"
            }`}
          >
            <p className="font-medium">{choice === o.ref && "✓ "}{o.label}</p>
            {o.sublabel && <p className="text-xs text-muted">{o.sublabel}</p>}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted" aria-live="polite">
        {pending ? "Salvando…" : choice ? "Voto registrado. Você pode trocar enquanto a rodada estiver aberta." : ""}
      </p>
      {error && <p className="text-xs text-red-300">{error}</p>}
    </div>
  );
}
