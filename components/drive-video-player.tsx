"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Toca um vídeo público do Drive no player do próprio navegador, lendo o
 * arquivo pela Drive API (chave restrita ao nosso domínio).
 *
 * - Sem o botão "abrir no Drive" do player do Google.
 * - Pausa quando a página é escondida: com Cache Components o Next mantém a
 *   página anterior montada (oculta) e o vídeo continuaria tocando.
 * - Se o Drive bloquear o download (cota de downloads do arquivo estourada, ou
 *   arquivo inacessível pela API), troca sozinho para o player do Google, que
 *   não usa essa cota.
 * - Se o formato não tocar no navegador, oferece o player do Google como reserva.
 */

// Arquivos que já falharam pela API nesta sessão: vão direto para o player do Google.
const blockedFiles = new Set<string>();

export function DriveVideoPlayer({ fileId, title }: { fileId: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);
  const [useFallback, setUseFallback] = useState(() => blockedFiles.has(fileId));

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

  // O <video> não informa o status HTTP do erro. Pergunta à API o motivo:
  // se for bloqueio do Drive (403/404), usa o player do Google sem perguntar;
  // se a API responder normalmente, o problema é o formato ou a conexão.
  async function handleVideoError() {
    setChecking(true);
    try {
      const res = await fetch(src, { headers: { Range: "bytes=0-0" } });
      res.body?.cancel().catch(() => {});
      if (res.status === 403 || res.status === 404) {
        blockedFiles.add(fileId);
        setUseFallback(true);
        return;
      }
    } catch {
      // sem rede: cai na mensagem de erro, que permite tentar de novo
    } finally {
      setChecking(false);
    }
    setFailed(true);
  }

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

  if (checking) {
    return <Message>Carregando vídeo…</Message>;
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
      onError={handleVideoError}
      className="h-full w-full bg-black"
      aria-label={`Vídeo: ${title}`}
    />
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return <div className="flex h-full flex-col items-center justify-center p-6 text-center text-sm">{children}</div>;
}
