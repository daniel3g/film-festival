"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Stage } from "@/components/telao/stage";
import { filmPath, readFile } from "@/lib/opfs";
import { channelName, type PanelMsg, type ProjectorMsg, type View } from "@/lib/telao";

/**
 * Janela do projetor: só desenha e toca o que o painel manda.
 * Não recebe notas nem vencedores antes do passo "vencedor".
 */
export default function Projector({ ceremonyId }: { ceremonyId: string }) {
  const [view, setView] = useState<View | null>(null);
  const [votes, setVotes] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const [localFiles, setLocalFiles] = useState<Record<string, File>>({});
  const channelRef = useRef<BroadcastChannel | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const send = useCallback((msg: ProjectorMsg) => channelRef.current?.postMessage(msg), []);

  useEffect(() => {
    const ch = new BroadcastChannel(channelName(ceremonyId));
    channelRef.current = ch;
    ch.onmessage = (e: MessageEvent<PanelMsg>) => {
      const msg = e.data;
      if (msg.type === "goto") {
        setView(msg.view);
        setVotes(msg.votes);
      } else if (msg.type === "count") {
        setVotes(msg.votes);
      } else if (msg.type === "localFile") {
        setLocalFiles((m) => ({ ...m, [msg.filmId]: msg.file }));
      } else if (msg.type === "video") {
        const v = videoRef.current;
        if (!v) return;
        if (msg.cmd === "play") void v.play().catch(() => {});
        if (msg.cmd === "pause") v.pause();
        if (msg.cmd === "restart") {
          v.currentTime = 0;
          void v.play().catch(() => {});
        }
        if (msg.cmd === "seek" && msg.t != null) v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + msg.t));
      }
    };
    ch.postMessage({ type: "ready" } satisfies ProjectorMsg);
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, [ceremonyId]);

  // Esconde o cursor parado.
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const move = () => {
      setIdle(false);
      clearTimeout(t);
      t = setTimeout(() => setIdle(true), 2500);
    };
    window.addEventListener("mousemove", move);
    move();
    return () => {
      window.removeEventListener("mousemove", move);
      clearTimeout(t);
    };
  }, []);

  function start() {
    setStarted(true);
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  const film = view?.kind === "filme" ? view : null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black"
      style={{ cursor: idle && started ? "none" : "default" }}
      onDoubleClick={() => void document.documentElement.requestFullscreen?.().catch(() => {})}
    >
      <div style={{ width: "min(100vw, calc(100vh * 16 / 9))" }}>
        <Stage
          view={view}
          votes={votes}
          video={
            film && started ? (
              <FilmPlayer
                key={film.film.id}
                filmId={film.film.id}
                title={film.film.title}
                driveFileId={film.driveFileId}
                hasVideo={film.hasVideo}
                localFile={localFiles[film.film.id] ?? null}
                videoRef={videoRef}
                send={send}
              />
            ) : undefined
          }
        />
      </div>

      {!started && (
        <button
          type="button"
          onClick={start}
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/85 text-center"
        >
          <span className="font-display text-4xl text-gold">Projetor</span>
          <span className="text-lg">Clique aqui para entrar em tela cheia e liberar o som dos filmes</span>
          <span className="text-sm text-muted">Arraste esta janela para o projetor antes de clicar. Duplo clique volta para a tela cheia.</span>
        </button>
      )}
    </div>
  );
}

/** Filme: pendrive (se escolhido no painel) → baixado (offline) → internet (Drive). */
function FilmPlayer({
  filmId,
  title,
  driveFileId,
  hasVideo,
  localFile,
  videoRef,
  send,
}: {
  filmId: string;
  title: string;
  driveFileId: string | null;
  hasVideo: boolean;
  localFile: File | null;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  send: (m: ProjectorMsg) => void;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    let blobUrl: string | null = null;
    (async () => {
      let source: "offline" | "pendrive" | "internet" | "erro" = "erro";
      let url: string | null = null;
      if (localFile) {
        url = blobUrl = URL.createObjectURL(localFile);
        source = "pendrive";
      } else {
        const f = await readFile(filmPath(filmId));
        if (f && f.size > 0) {
          url = blobUrl = URL.createObjectURL(f);
          source = "offline";
        } else if (hasVideo) {
          url = `/api/video/${filmId}`;
          source = "internet";
        } else if (driveFileId && process.env.NEXT_PUBLIC_GOOGLE_API_KEY) {
          url = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media&key=${process.env.NEXT_PUBLIC_GOOGLE_API_KEY}`;
          source = "internet";
        }
      }
      if (!alive) {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        return;
      }
      setError(false);
      setSrc(url);
      send({ type: "video:source", filmId, source });
    })();
    return () => {
      alive = false;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [filmId, driveFileId, hasVideo, localFile, send]);

  const last = useRef(0);
  const report = (force = false) => {
    const v = videoRef.current;
    if (!v) return;
    const now = performance.now();
    if (!force && now - last.current < 500) return;
    last.current = now;
    send({ type: "video:state", filmId, t: v.currentTime, d: v.duration || 0, paused: v.paused, ended: v.ended });
  };

  if (!src || error) {
    return <span className="msg">{error ? `Não foi possível tocar "${title}". Veja o painel.` : `Carregando "${title}"…`}</span>;
  }
  return (
    <video
      ref={videoRef}
      src={src}
      autoPlay
      playsInline
      onTimeUpdate={() => report()}
      onPlay={() => report(true)}
      onPause={() => report(true)}
      onEnded={() => report(true)}
      onLoadedMetadata={() => report(true)}
      onError={() => {
        setError(true);
        send({ type: "video:source", filmId, source: "erro" });
      }}
    />
  );
}
