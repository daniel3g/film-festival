"use client";

import { useState, useTransition } from "react";
import { resetVoting } from "./actions";

/**
 * Zera a votação de uma cerimônia (testes / ensaio). Pede para digitar a
 * sigla da cerimônia, para não ser clicado por engano no dia do festival.
 */
export function ResetVoting({
  ceremonyId,
  ceremonyName,
  prefix,
}: {
  ceremonyId: string;
  ceremonyName: string;
  prefix: string;
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();

  function run() {
    const typed = window.prompt(
      `ZERAR a votação de "${ceremonyName}"?\n\n` +
        "Apaga TODOS os votos e TODOS os códigos (cartões impressos deixam de valer) " +
        'e volta a votação para "não aberta". Não dá para desfazer.\n\n' +
        `Para confirmar, digite a sigla da cerimônia: ${prefix}`,
    );
    if (typed === null) return;
    if (typed.trim().toUpperCase() !== prefix.toUpperCase()) {
      setMsg({ ok: false, text: "Sigla não confere. Nada foi apagado." });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const r = await resetVoting(ceremonyId);
      setMsg(
        r.ok
          ? { ok: true, text: `Votação zerada: ${r.votes} voto(s) e ${r.codes} código(s) apagados.` }
          : { ok: false, text: r.error },
      );
    });
  }

  return (
    <div className="border-t border-white/10 pt-3">
      <button
        type="button"
        className="text-xs text-red-300/80 underline-offset-2 hover:text-red-300 hover:underline disabled:opacity-50"
        disabled={pending}
        onClick={run}
      >
        {pending ? "Zerando…" : "Zerar votação (teste / ensaio)"}
      </button>
      {msg && <p className={`mt-1 text-xs ${msg.ok ? "text-emerald-300" : "text-red-300"}`}>{msg.text}</p>}
    </div>
  );
}
