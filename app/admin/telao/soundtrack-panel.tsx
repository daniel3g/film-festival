"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { FormStatus } from "@/components/form-status";
import type { ActionState } from "@/lib/admin";
import { CUE_ORDER, CUES, Soundtrack } from "@/lib/soundtrack";
import type { Cue } from "@/lib/telao";
import { removeTrack, setTrack } from "./actions";
import type { DlTrack } from "./download-panel";

const TYPES: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav" };
const MAX_BYTES = 30 * 1024 * 1024;

/** Faixas da trilha: ouvir, trocar (upload) e voltar ao exemplo. */
export function SoundtrackPanel({ editionId, tracks }: { editionId: string; tracks: DlTrack[] }) {
  const [state, setState] = useState<ActionState>();
  const [pending, startTransition] = useTransition();
  const [busyCue, setBusyCue] = useState<Cue | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadCue = useRef<Cue | null>(null);

  const player = useMemo(
    () => new Soundtrack(async (cue) => tracks.find((t) => t.cue === cue)?.url ?? null),
    [tracks],
  );
  useEffect(() => () => player.dispose(), [player]);
  const playing = useSyncExternalStore(
    (fn) => player.subscribe(fn),
    () => player.current?.cue ?? null,
    () => null,
  );

  function preview(cue: Cue) {
    player.unlock();
    if (playing === cue) player.stop(0.6);
    else void player.play(cue, { preview: true });
  }

  function pick(cue: Cue) {
    uploadCue.current = cue;
    inputRef.current?.click();
  }

  function onFile(file: File | undefined) {
    const cue = uploadCue.current;
    if (!file || !cue) return;
    const ext = TYPES[file.type];
    if (!ext) return setState({ error: "Use um arquivo MP3, M4A, OGG ou WAV." });
    if (file.size > MAX_BYTES) return setState({ error: "O arquivo passa de 30 MB." });
    setBusyCue(cue);
    startTransition(async () => {
      setState(undefined);
      const path = `${editionId}/${cue}-${Date.now()}.${ext}`;
      const contentType = file.type === "audio/x-wav" ? "audio/wav" : file.type;
      const { error } = await createClient().storage.from("soundtrack").upload(path, file, { contentType, upsert: false });
      if (error) setState({ error: `Falha no envio: ${error.message}` });
      else setState(await setTrack(cue, path, file.name, file.size));
      setBusyCue(null);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="space-y-3">
      <input ref={inputRef} type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      <ul className="divide-y divide-gold/10">
        {CUE_ORDER.map((cue) => {
          const info = CUES[cue];
          const track = tracks.find((t) => t.cue === cue);
          return (
            <li key={cue} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-medium">{info.name}</p>
                <p className="text-xs text-muted">
                  {info.moment} · {info.loop ? "repete até avançar" : "toca uma vez e passa para Ambiente"}
                </p>
                <p className="mt-1 text-sm">
                  {track ? (
                    <span className="text-emerald-300">♪ {track.fileName ?? "arquivo enviado"}</span>
                  ) : (
                    <span className="text-muted">Exemplo: {info.example}</span>
                  )}
                </p>
              </div>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => preview(cue)}>
                  {playing === cue ? "■ Parar" : "▶ Ouvir"}
                </button>
                <button type="button" className="btn-ghost px-3 py-1 text-xs" disabled={pending} onClick={() => pick(cue)}>
                  {busyCue === cue ? "Enviando…" : "Trocar"}
                </button>
                {track && (
                  <button
                    type="button"
                    className="btn-danger px-3 py-1 text-xs"
                    disabled={pending}
                    onClick={() =>
                      window.confirm(`Voltar a usar o exemplo em "${info.name}"?`) &&
                      startTransition(async () => setState(await removeTrack(cue)))
                    }
                  >
                    Usar exemplo
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <FormStatus state={state} />
    </div>
  );
}
