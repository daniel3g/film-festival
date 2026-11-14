// Armazenamento local do navegador (OPFS) para o telão offline.
// Pastas: films/{filmId}, posters/{filmId}, soundtrack/{trackId}

export function opfsSupported() {
  return typeof navigator !== "undefined" && !!navigator.storage?.getDirectory;
}

async function locate(path: string, create: boolean) {
  const parts = path.split("/");
  const name = parts.pop()!;
  let dir = await navigator.storage.getDirectory();
  for (const p of parts) dir = await dir.getDirectoryHandle(p, { create });
  return { dir, name };
}

/** Arquivo salvo, ou null se não existir. */
export async function readFile(path: string): Promise<File | null> {
  if (!opfsSupported()) return null;
  try {
    const { dir, name } = await locate(path, false);
    return await (await dir.getFileHandle(name)).getFile();
  } catch {
    return null;
  }
}

/** Grava um download em blocos, informando os bytes recebidos. */
export async function writeStream(
  path: string,
  body: ReadableStream<Uint8Array>,
  onBytes: (received: number) => void,
  signal?: AbortSignal,
) {
  const { dir, name } = await locate(path, true);
  const handle = await dir.getFileHandle(name, { create: true });
  const writable = await handle.createWritable();
  let received = 0;
  const counter = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      received += chunk.byteLength;
      onBytes(received);
      ctrl.enqueue(chunk);
    },
  });
  // pipeTo fecha o arquivo no fim e aborta (descarta) em caso de erro.
  await body.pipeThrough(counter).pipeTo(writable, { signal });
  return received;
}

export async function removeFile(path: string) {
  if (!opfsSupported()) return;
  try {
    const { dir, name } = await locate(path, false);
    await dir.removeEntry(name);
  } catch {
    /* já não existia */
  }
}

/** URL local (blob:) de um arquivo salvo. Lembre de revogar. */
export async function objectUrl(path: string): Promise<string | null> {
  const f = await readFile(path);
  return f ? URL.createObjectURL(f) : null;
}

export const filmPath = (filmId: string) => `films/${filmId}`;
export const posterPath = (filmId: string) => `posters/${filmId}`;
export const trackPath = (trackId: string) => `soundtrack/${trackId}`;
