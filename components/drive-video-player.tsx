"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Toca um vídeo público do Drive no player do próprio navegador, lendo o
 * arquivo pela Drive API (chave restrita ao nosso domínio).
 *
 * - Sem o botão "abrir no Drive" do player do Google.
 * - Pausa quando a página é escondida: com Cache Components o Next mantém a
 *   página anterior montada (oculta) e o vídeo continuaria tocando.
 * - Se o formato não tocar no navegador, oferece o player do Google como reserva.
 */
export function DriveVideoPlayer({ fileId, title }: { fileId: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);
  const [useFallback, setUseFallback] = useState(false);

  const key = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const src = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${key}`;
  const fallbackSrc = `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;

  useLayoutEffect(() => {
    const video = videoRef.current;
    const iframe = iframeRef.current;
    if (iframe && iframe.src !== fallbackSrc) iframe.src = fallbackSrc;
    return () => {
      video?.pause(); // guarda a posição; retoma de onde parou ao voltar
      if (iframe) iframe.src = "about:blank"; // o iframe não tem pause: descarrega
    };
  }, [useFallback, fallbackSrc]);

  if (!key) {
    return <Message>Player não configurado (falta a chave do Google). Avise a organização.</Message>;
  }

  if (useFallback) {
    return (
      <iframe
        ref={iframeRef}
        src={fallbackSrc}
        className="h-full w-full"
        allow="autoplay; fullscreen"
        allowFullScreen
        title={`Vídeo: ${title}`}
      />
    );
  }

  if (failed) {
    return (
      <Message>
        <p>Não foi possível tocar este vídeo no navegador.</p>
        <p className="mt-1 text-xs text-muted">
          Pode ser o formato do arquivo ou a conexão. Tente recarregar a página ou use o player do Google Drive.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn-ghost" onClick={() => setFailed(false)}>
            Tentar de novo
          </button>
          <button type="button" className="btn" onClick={() => setUseFallback(true)}>
            Usar player do Google Drive
          </button>
        </div>
      </Message>
    );
  }

  return (
    <video
      ref={videoRef}
      src={src}
      controls
      preload="metadata"
      playsInline
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      onError={() => setFailed(true)}
      className="h-full w-full bg-black"
      aria-label={`Vídeo: ${title}`}
    />
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm">{children}</div>;
}
