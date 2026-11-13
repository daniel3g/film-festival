"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { FormStatus } from "@/components/form-status";
import type { ActionState } from "@/lib/admin";
import { removeFilmPoster, setFilmPoster } from "../actions";

const TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_BYTES = 10 * 1024 * 1024;

/** Envia o pôster direto do navegador para o Storage (sem passar pelo servidor). */
export function PosterUpload({ filmId, posterUrl }: { filmId: string; posterUrl: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ActionState>();
  const [pending, startTransition] = useTransition();

  function onFile(file: File | undefined) {
    if (!file) return;
    const ext = TYPES[file.type];
    if (!ext) return setState({ error: "Use uma imagem JPG, PNG ou WebP." });
    if (file.size > MAX_BYTES) return setState({ error: "A imagem passa de 10 MB. Reduza e tente de novo." });

    startTransition(async () => {
      setState(undefined);
      const path = `${filmId}/${Date.now()}.${ext}`;
      const { error } = await createClient()
        .storage.from("posters")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) {
        setState({ error: `Falha no envio: ${error.message}` });
        return;
      }
      setState(await setFilmPoster(filmId, path));
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-md border border-gold/20 bg-background">
        {posterUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- URL assinada e temporária do Storage
          <img src={posterUrl} alt="Pôster do filme" className="h-full w-full object-cover" />
        ) : (
          <span className="px-4 text-center text-sm text-muted">Sem pôster</span>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost" disabled={pending} onClick={() => inputRef.current?.click()}>
          {pending ? "Enviando…" : posterUrl ? "Trocar pôster" : "Enviar pôster"}
        </button>
        {posterUrl && (
          <button
            type="button"
            className="btn-danger"
            disabled={pending}
            onClick={() =>
              window.confirm("Remover o pôster?") &&
              startTransition(async () => setState(await removeFilmPoster(filmId)))
            }
          >
            Remover
          </button>
        )}
      </div>
      <p className="text-xs text-muted">JPG, PNG ou WebP, até 10 MB. Formato retrato (2:3) fica melhor.</p>
      <FormStatus state={state} />
    </div>
  );
}
