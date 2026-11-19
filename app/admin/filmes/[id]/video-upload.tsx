"use client";

import { useRef, useState } from "react";
import { FormStatus } from "@/components/form-status";
import type { ActionState } from "@/lib/admin";
import { createVideoUpload, setFilmVideo } from "../actions";

const TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_BYTES = 4.5 * 1024 ** 3; // envio único no R2 vai até 5 GB

/** Envia o vídeo direto do navegador para o R2 (sem passar pela Vercel). */
export function VideoUpload({ filmId, hasVideo }: { filmId: string; hasVideo: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const [state, setState] = useState<ActionState>();
  const [progress, setProgress] = useState<number | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!TYPES.includes(file.type)) return setState({ error: "Use um vídeo MP4 (de preferência), MOV ou WebM." });
    if (file.size > MAX_BYTES) return setState({ error: "O vídeo passa de 4,5 GB. Exporte em tamanho menor." });

    setState(undefined);
    setProgress(0);
    try {
      const durationMs = await readDuration(file);
      if (durationMs === null) {
        setState({ error: "Este navegador não consegue abrir o vídeo. Exporte em MP4 (H.264) e tente de novo." });
        return;
      }
      const up = await createVideoUpload(filmId, file.name, file.type);
      if ("error" in up) return setState({ error: up.error });

      await put(up.url, file, (p) => setProgress(p));
      setState(await setFilmVideo(filmId, up.key, file.size, durationMs));
    } catch (e) {
      setState({ error: e instanceof Error ? e.message : "Falha no envio." });
    } finally {
      setProgress(null);
      xhrRef.current = null;
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function put(url: string, file: File, onProgress: (p: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhrRef.current = xhr;
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", file.type);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
      xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error(`O servidor de vídeos respondeu ${xhr.status}.`)));
      xhr.onerror = () => reject(new Error("Falha de conexão no envio. Tente de novo."));
      xhr.onabort = () => reject(new Error("Envio cancelado."));
      xhr.send(file);
    });
  }

  const sending = progress !== null;

  return (
    <div className="space-y-3">
      <input
        ref={inputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap items-center gap-3">
        {sending ? (
          <>
            <div className="h-2 w-56 overflow-hidden rounded-full bg-gold/10">
              <div className="h-full bg-gold transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
            <span className="text-sm tabular-nums">{Math.floor(progress * 100)}%</span>
            <button type="button" className="btn-ghost" onClick={() => xhrRef.current?.abort()}>
              Cancelar
            </button>
          </>
        ) : (
          <button type="button" className={hasVideo ? "btn-ghost" : "btn"} onClick={() => inputRef.current?.click()}>
            {hasVideo ? "Trocar vídeo" : "Enviar vídeo"}
          </button>
        )}
      </div>
      {sending && <p className="text-xs text-muted">Não feche esta página até terminar.</p>}
      <FormStatus state={state} />
    </div>
  );
}

/** Abre o arquivo num vídeo oculto para ler a duração (e confirmar que o navegador toca). */
function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (ms: number | null) => {
      clearTimeout(t);
      v.removeAttribute("src");
      v.load();
      URL.revokeObjectURL(url);
      resolve(ms);
    };
    const t = setTimeout(() => done(null), 20000);
    v.onloadedmetadata = () => done(Number.isFinite(v.duration) && v.duration > 0 ? Math.round(v.duration * 1000) : null);
    v.onerror = () => done(null);
    v.src = url;
  });
}
