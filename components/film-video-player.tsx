"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Player do filme no navegador.
 *
 * - Primeiro o vídeo no R2 (/api/video/{id} → link assinado). Sem cota de
 *   downloads e sem custo de tráfego.
 * - Se o filme ainda não estiver no R2, lê do Drive pela API (chave restrita ao
 *   nosso domínio). Se o Drive bloquear o download (cota estourada ou arquivo
 *   inacessível), troca sozinho para o player do Google, que não usa essa cota.
 * - Pausa quando a página é escondida: com Cache Components o Next mantém a
 *   página anterior montada (oculta) e o vídeo continuaria tocando.
 */

// Arquivos do Drive que já falharam pela API nesta sessão: vão direto para o player do Google.
const blockedDrive = new Set<string>();

type Mode = "r2" | "drive" | "iframe";

export function FilmVideoPlayer({
  filmId,
  hasVideo,
  driveFileId,
  title,
}: {
  filmId: string;
  /** O filme tem vídeo no R2 (video_key). */
  hasVideo: boolean;
  driveFileId: string | null;
  title: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mode, setMode] = useState<Mode>(() =>
    hasVideo ? "r2" : driveFileId && blockedDrive.has(driveFileId) ? "iframe" : "drive",
  );
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const key = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const driveSrc = driveFileId && key ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(driveFileId)}?alt=media&key=${key}` : null;
  const iframeSrc = driveFileId ? `https://drive.google.com/file/d/${encodeURIComponent(driveFileId)}/preview` : null;
  const src = mode === "r2" ? `/api/video/${filmId}` : driveSrc;

  useLayoutEffect(() => {
    const video = videoRef.current;
    const iframe = iframeRef.current;
    if (iframe && iframeSrc && iframe.src !== iframeSrc) iframe.src = iframeSrc;
    return () => {
      video?.pause(); // guarda a posição; retoma de onde parou ao voltar
      if (iframe) iframe.src = "about:blank"; // o iframe não tem pause: descarrega
    };
  }, [mode, iframeSrc]);

  // O <video> não informa o status HTTP do erro. No Drive, pergunta à API o
  // motivo: bloqueio (403/404) → player do Google sem perguntar; senão, o
  // problema é o formato ou a conexão.
  async function handleVideoError() {
    if (mode === "drive" && driveSrc && driveFileId) {
      setChecking(true);
      try {
        const res = await fetch(driveSrc, { headers: { Range: "bytes=0-0" } });
        res.body?.cancel().catch(() => {});
        if (res.status === 403 || res.status === 404) {
          blockedDrive.add(driveFileId);
          setMode("iframe");
          return;
        }
      } catch {
        // sem rede: cai na mensagem de erro, que permite tentar de novo
      } finally {
        setChecking(false);
      }
    }
    setFailed(true);
  }

  if (mode === "iframe" && iframeSrc) {
    return (
      <iframe
        ref={iframeRef}
        src={iframeSrc}
        className="h-full w-full"
        allow="autoplay; fullscreen"
        allowFullScreen
        title={`Vídeo: ${title}`}
      />
    );
  }

  if (!src) {
    return <Message>Player não configurado (falta a chave do Google). Avise a organização.</Message>;
  }

  if (checking) {
    return <Message>Carregando vídeo…</Message>;
  }

  if (failed) {
    return (
      <Message>
        <p>Não foi possível tocar este vídeo no navegador.</p>
        <p className="mt-1 text-xs text-muted">
          Pode ser o formato do arquivo ou a conexão. Tente de novo
          {iframeSrc ? " ou use o player do Google Drive" : ""}.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setFailed(false);
              setAttempt((n) => n + 1);
            }}
          >
            Tentar de novo
          </button>
          {iframeSrc && (
            <button type="button" className="btn" onClick={() => setMode("iframe")}>
              Usar player do Google Drive
            </button>
          )}
        </div>
      </Message>
    );
  }

  return (
    <video
      key={attempt}
      ref={videoRef}
      src={src}
      controls
      preload="metadata"
      playsInline
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      onError={handleVideoError}
      className="h-full w-full bg-black"
      aria-label={`Vídeo: ${title}`}
    />
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm">{children}</div>;
}
