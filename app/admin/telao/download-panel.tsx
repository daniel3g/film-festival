"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { filmPath, opfsSupported, posterPath, readFile, removeFile, trackPath, writeStream } from "@/lib/opfs";
import type { Cue } from "@/lib/telao";

export type DlFilm = {
  id: string;
  title: string;
  driveFileId: string | null;
  hasVideo: boolean;
  sizeBytes: number | null;
  durationMs: number | null;
  posterUrl: string | null;
};
export type DlCeremony = { id: string; name: string; films: DlFilm[] };
export type DlTrack = { id: string; cue: Cue; url: string | null; fileName: string | null; sizeBytes: number | null };

type FilmState =
  | { s: "falta" }
  | { s: "baixando"; got: number }
  | { s: "conferindo" }
  | { s: "ok"; size: number }
  | { s: "nao-conferido"; size: number }
  | { s: "erro"; msg: string };

const okKey = (filmId: string) => `telao:ok:${filmId}`;
const mb = (n: number) => `${(n / 1048576).toFixed(0)} MB`;
const gb = (n: number) => `${(n / 1073741824).toFixed(1).replace(".", ",")} GB`;

/** Download dos filmes, pôsteres e trilha para o armazenamento do navegador (OPFS). */
export function DownloadPanel({ ceremonies, tracks }: { ceremonies: DlCeremony[]; tracks: DlTrack[] }) {
  const [supported] = useState(() => typeof window === "undefined" || opfsSupported());
  const [states, setStates] = useState<Record<string, FilmState>>({});
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setFilm = (id: string, st: FilmState) => setStates((m) => ({ ...m, [id]: st }));

  const refreshStorage = useCallback(async () => setStorage(await readStorage()), []);

  const check = useCallback(async () => {
    setStates(await scanFilms(ceremonies));
    void refreshStorage();
  }, [ceremonies, refreshStorage]);

  useEffect(() => {
    if (!supported) return;
    let alive = true;
    scanFilms(ceremonies).then((out) => alive && setStates(out));
    readStorage().then((s) => alive && setStorage(s));
    return () => {
      alive = false;
    };
  }, [supported, ceremonies]);

  async function download(c: DlCeremony) {
    setMessage(null);
    setRunning(c.id);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      await navigator.storage.persist?.();
      const need = c.films.reduce((a, f) => a + (f.sizeBytes ?? 0), 0);
      const est = await navigator.storage.estimate();
      if (est.quota && est.usage != null && est.quota - est.usage < need * 1.1) {
        setMessage(`Pouco espaço livre no navegador: precisa de ${gb(need)}. Libere espaço no disco e tente de novo.`);
        return;
      }

      for (const f of c.films) {
        if (ctrl.signal.aborted) break;
        const cur = await readFile(filmPath(f.id));
        const done = cur && f.sizeBytes && cur.size === f.sizeBytes && localStorage.getItem(okKey(f.id)) === String(cur.size);
        if (!done) await downloadFilm(f, ctrl.signal);
        if (f.posterUrl) await saveUrl(f.posterUrl, posterPath(f.id), ctrl.signal).catch(() => {});
      }
      for (const t of tracks) {
        if (t.url) await saveUrl(t.url, trackPath(t.id), ctrl.signal).catch(() => {});
      }
      if (!ctrl.signal.aborted) setMessage(`${c.name}: download concluído. Agora abra o modo apresentação uma vez com internet, para ele ficar guardado.`);
    } catch (e) {
      if (!ctrl.signal.aborted) setMessage(e instanceof Error ? e.message : "Falha no download.");
    } finally {
      setRunning(null);
      abortRef.current = null;
      void refreshStorage();
    }
  }

  async function downloadFilm(f: DlFilm, signal: AbortSignal) {
    // Servidor do festival (R2) primeiro; o Drive tem cota de downloads por arquivo.
    const key = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
    const url = f.hasVideo
      ? `/api/video/${f.id}`
      : f.driveFileId && key
        ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.driveFileId)}?alt=media&key=${key}`
        : null;
    if (!url) {
      setFilm(f.id, { s: "erro", msg: "sem vídeo" });
      return;
    }
    localStorage.removeItem(okKey(f.id));
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        setFilm(f.id, { s: "baixando", got: 0 });
        const res = await fetch(url, { signal });
        if (!res.ok || !res.body) {
          throw new Error(
            res.status === 403 && !f.hasVideo ? "Drive bloqueou (limite de downloads): envie o vídeo no cadastro" : `servidor respondeu ${res.status}`,
          );
        }
        let lastUi = 0;
        const size = await writeStream(
          filmPath(f.id),
          res.body,
          (got) => {
            const now = performance.now();
            if (now - lastUi > 250) {
              lastUi = now;
              setFilm(f.id, { s: "baixando", got });
            }
          },
          signal,
        );
        if (f.sizeBytes && size !== f.sizeBytes) throw new Error("tamanho diferente do cadastro");
        setFilm(f.id, { s: "conferindo" });
        const file = await readFile(filmPath(f.id));
        if (!file) throw new Error("arquivo não encontrado depois do download");
        const problem = await verifyVideo(file, f.durationMs);
        if (problem) throw new Error(problem);
        localStorage.setItem(okKey(f.id), String(file.size));
        setFilm(f.id, { s: "ok", size: file.size });
        return;
      } catch (e) {
        if (signal.aborted) {
          setFilm(f.id, { s: "falta" });
          await removeFile(filmPath(f.id));
          return;
        }
        if (attempt === 2) setFilm(f.id, { s: "erro", msg: e instanceof Error ? e.message : "falha" });
      }
    }
  }

  async function clear(c: DlCeremony) {
    if (!window.confirm(`Apagar deste computador os filmes baixados de "${c.name}"?`)) return;
    for (const f of c.films) {
      await removeFile(filmPath(f.id));
      await removeFile(posterPath(f.id));
      localStorage.removeItem(okKey(f.id));
    }
    await check();
  }

  if (!supported) {
    return (
      <p className="card p-5 text-amber-300">
        Este navegador não permite guardar os filmes. Use o Google Chrome atualizado no notebook do telão.
      </p>
    );
  }

  return (
    <section className="space-y-4">
      {storage && (
        <p className="text-sm text-muted">
          Espaço usado neste navegador: {gb(storage.usage)} de {gb(storage.quota)} disponíveis ·{" "}
          {storage.persisted ? (
            <span className="text-emerald-300">armazenamento protegido</span>
          ) : (
            <span className="text-amber-300">o navegador pode apagar os arquivos se faltar espaço (protegido ao baixar)</span>
          )}
        </p>
      )}
      {message && <p className="rounded-md border border-gold/30 bg-gold/5 p-3 text-sm">{message}</p>}

      <div className="grid gap-4 lg:grid-cols-3">
        {ceremonies.map((c) => {
          const total = c.films.reduce((a, f) => a + (f.sizeBytes ?? 0), 0);
          const allOk = c.films.length > 0 && c.films.every((f) => states[f.id]?.s === "ok");
          return (
            <article key={c.id} className="card space-y-4 p-5">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-xl">{c.name}</h2>
                {allOk ? (
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">✓ Pronto offline</span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">Não baixado</span>
                )}
              </div>
              {c.films.length === 0 ? (
                <p className="text-sm text-muted">Nenhum filme cadastrado.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {c.films.map((f) => (
                    <li key={f.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">{f.title}</span>
                      <FilmBadge st={states[f.id]} total={f.sizeBytes} />
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                {running === c.id ? (
                  <button type="button" className="btn-ghost" onClick={() => abortRef.current?.abort()}>
                    Cancelar
                  </button>
                ) : (
                  <button type="button" className={allOk ? "btn-ghost" : "btn"} disabled={!!running || !c.films.length} onClick={() => download(c)}>
                    {allOk ? "Baixar de novo o que faltar" : `Baixar filmes${total ? ` (${gb(total)})` : ""}`}
                  </button>
                )}
                {/* <a> (carga completa): o service worker guarda a página para uso offline */}
                <a href={`/telao/${c.id}`} className={allOk ? "btn" : "btn-ghost"}>
                  Abrir modo apresentação
                </a>
              </div>
              <button type="button" className="text-xs text-muted underline-offset-2 hover:underline" disabled={!!running} onClick={() => clear(c)}>
                Apagar filmes baixados
              </button>
            </article>
          );
        })}
      </div>
      <p className="text-sm text-muted">
        O download fica <strong>neste computador e neste navegador</strong>. Se trocarem de máquina, é preciso baixar de
        novo. Leve também um pendrive com os vídeos: o painel permite escolher o arquivo se algo falhar.
      </p>
    </section>
  );
}

function FilmBadge({ st, total }: { st: FilmState | undefined; total: number | null }) {
  if (!st) return <span className="text-xs text-muted">…</span>;
  switch (st.s) {
    case "falta":
      return <span className="text-xs text-muted">{total ? mb(total) : "—"}</span>;
    case "baixando":
      return (
        <span className="text-xs tabular-nums text-gold">
          {total ? `${Math.floor((st.got / total) * 100)}%` : mb(st.got)}
        </span>
      );
    case "conferindo":
      return <span className="text-xs text-gold">conferindo…</span>;
    case "ok":
      return <span className="text-xs text-emerald-300">✓ conferido</span>;
    case "nao-conferido":
      return <span className="text-xs text-amber-300">baixado, não conferido</span>;
    case "erro":
      return <span className="text-xs text-red-300">✖ {st.msg}</span>;
  }
}

async function readStorage() {
  if (!navigator.storage?.estimate) return null;
  const [est, persisted] = await Promise.all([navigator.storage.estimate(), navigator.storage.persisted?.() ?? false]);
  return { usage: est.usage ?? 0, quota: est.quota ?? 0, persisted };
}

/** Situação de cada filme neste computador. */
async function scanFilms(ceremonies: DlCeremony[]) {
  const out: Record<string, FilmState> = {};
  for (const c of ceremonies) {
    for (const f of c.films) {
      const file = await readFile(filmPath(f.id));
      if (!file || file.size === 0) out[f.id] = { s: "falta" };
      else if (f.sizeBytes && file.size !== f.sizeBytes) out[f.id] = { s: "erro", msg: "incompleto" };
      else out[f.id] = localStorage.getItem(okKey(f.id)) === String(file.size) ? { s: "ok", size: file.size } : { s: "nao-conferido", size: file.size };
    }
  }
  return out;
}

async function saveUrl(url: string, path: string, signal: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  await writeStream(path, res.body, () => {}, signal);
}

function waitFor(el: HTMLMediaElement, event: string, ms: number) {
  return new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => done(new Error("o vídeo não respondeu a tempo")), ms);
    const ok = () => done();
    const fail = () => done(new Error("o navegador não consegue ler este vídeo"));
    function done(err?: Error) {
      clearTimeout(t);
      el.removeEventListener(event, ok);
      el.removeEventListener("error", fail);
      if (err) reject(err);
      else resolve();
    }
    el.addEventListener(event, ok);
    el.addEventListener("error", fail);
  });
}

/** Abre o arquivo num vídeo oculto: confere a duração e se decodifica perto do fim. */
async function verifyVideo(file: File, durationMs: number | null): Promise<string | null> {
  const url = URL.createObjectURL(file);
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "metadata";
  try {
    const meta = waitFor(v, "loadedmetadata", 30000);
    v.src = url;
    await meta;
    if (!Number.isFinite(v.duration) || v.duration <= 0) return "duração inválida";
    if (durationMs && Math.abs(v.duration * 1000 - durationMs) > 1500) return "duração diferente da do cadastro";
    const seeked = waitFor(v, "seeked", 30000);
    v.currentTime = Math.max(0, v.duration - 1);
    await seeked;
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : "falha ao conferir";
  } finally {
    v.removeAttribute("src");
    v.load();
    URL.revokeObjectURL(url);
  }
}
