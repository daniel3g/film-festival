import "server-only";

export type DriveLinkResult =
  | { ok: true; fileId: string }
  | { ok: false; error: string };

/** Extrai o ID do arquivo de um link de compartilhamento do Google Drive. */
export function parseDriveLink(input: string): DriveLinkResult {
  const s = input.trim();
  if (!s) return { ok: false, error: "Cole o link do vídeo no Drive." };

  // Já é um ID.
  if (/^[A-Za-z0-9_-]{20,}$/.test(s)) return { ok: true, fileId: s };

  let url: URL;
  try {
    url = new URL(s);
  } catch {
    return { ok: false, error: "Isso não parece um link. Copie o link em Compartilhar → Copiar link." };
  }
  if (!/(^|\.)google\.com$/.test(url.hostname)) {
    return { ok: false, error: "O link precisa ser do Google Drive (drive.google.com)." };
  }
  if (url.pathname.includes("/folders/")) {
    return { ok: false, error: "Esse é o link da pasta. Abra o vídeo e copie o link do arquivo." };
  }

  const fromPath = url.pathname.match(/\/file\/d\/([A-Za-z0-9_-]{10,})/)?.[1];
  const fromQuery = url.searchParams.get("id");
  const fileId = fromPath ?? (fromQuery && /^[A-Za-z0-9_-]{10,}$/.test(fromQuery) ? fromQuery : null);

  return fileId
    ? { ok: true, fileId }
    : { ok: false, error: "Não encontrei o arquivo nesse link. Copie o link do vídeo em Compartilhar → Copiar link." };
}

export type DriveMetadata =
  | { status: "ok"; name: string; mimeType: string; sizeBytes: number | null; durationMs: number | null; md5: string | null }
  | { status: "skipped" } // sem chave de API configurada
  | { status: "not_found" } // arquivo não existe ou não está público
  | { status: "error"; message: string };

/**
 * Lê os metadados do vídeo com a chave de API (funciona só para arquivos
 * compartilhados como "qualquer pessoa com o link").
 */
export async function fetchDriveMetadata(fileId: string): Promise<DriveMetadata> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  if (!key) return { status: "skipped" };

  const url = new URL(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`);
  url.searchParams.set("fields", "name,mimeType,size,md5Checksum,videoMediaMetadata(durationMillis)");
  url.searchParams.set("supportsAllDrives", "true");
  url.searchParams.set("key", key);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      // A chave é restrita por domínio; chamadas do servidor informam o endereço do site.
      headers: process.env.NEXT_PUBLIC_SITE_URL ? { Referer: process.env.NEXT_PUBLIC_SITE_URL } : {},
    });
    if (res.status === 404 || res.status === 403) return { status: "not_found" };
    if (!res.ok) return { status: "error", message: `Drive respondeu ${res.status}` };

    const data = (await res.json()) as {
      name: string;
      mimeType: string;
      size?: string;
      md5Checksum?: string;
      videoMediaMetadata?: { durationMillis?: string };
    };
    return {
      status: "ok",
      name: data.name,
      mimeType: data.mimeType,
      sizeBytes: data.size ? Number(data.size) : null,
      durationMs: data.videoMediaMetadata?.durationMillis ? Number(data.videoMediaMetadata.durationMillis) : null,
      md5: data.md5Checksum ?? null,
    };
  } catch (e) {
    return { status: "error", message: e instanceof Error ? e.message : "falha de rede" };
  }
}
