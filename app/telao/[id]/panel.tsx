"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Stage } from "@/components/telao/stage";
import { filmPath, objectUrl, readFile, trackPath } from "@/lib/opfs";
import { CUES, Soundtrack } from "@/lib/soundtrack";
import {
  buildSteps,
  channelName,
  cueFor,
  stepLabel,
  viewFor,
  type Award,
  type Cue,
  type PanelMsg,
  type ProjectorMsg,
  type Show,
  type Step,
} from "@/lib/telao";
import { closeVotingFromTelao, fetchPeoplesChoice } from "../actions";

type VideoState = { filmId: string; t: number; d: number; paused: boolean; ended: boolean };
type FilmSource = "offline" | "pendrive" | "internet" | "erro";

const storeKey = (id: string) => `telao:${id}:step`;

/** Painel do apresentador (notebook). É a fonte da verdade do roteiro. */
export default function Panel({ show }: { show: Show }) {
  const id = show.ceremony.id;
  const steps = useMemo(() => buildSteps(show), [show]);

  const [index, setIndex] = useState(() => {
    try {
      const n = Number(sessionStorage.getItem(storeKey(id)));
      return Number.isInteger(n) && n >= 0 && n < steps.length ? n : 0;
    } catch {
      return 0;
    }
  });
  const [status, setStatus] = useState(show.ceremony.votingStatus);
  const [pc, setPc] = useState<Award | null>(show.pc);
  const [votes, setVotes] = useState<number | null>(null);
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ text: string; bad?: boolean } | null>(null);
  const [projectorSeen, setProjectorSeen] = useState(false);
  const [video, setVideo] = useState<VideoState | null>(null);
  const [sources, setSources] = useState<Record<string, FilmSource>>({});
  const [offline, setOffline] = useState<Record<string, "ok" | "incompleto" | "falta">>({});
  const [startedAt, setStartedAt] = useState(() => Date.now());

  const step = steps[index];
  const view = useMemo(() => viewFor(show, step, pc), [show, step, pc]);

  // ---------------------------------------------------------------- canal com o projetor
  const channelRef = useRef<BroadcastChannel | null>(null);
  const post = useCallback((m: PanelMsg) => channelRef.current?.postMessage(m), []);
  const latest = useRef({ view, votes, index });
  useEffect(() => {
    latest.current = { view, votes, index };
  });

  useEffect(() => {
    const ch = new BroadcastChannel(channelName(id));
    channelRef.current = ch;
    ch.onmessage = (e: MessageEvent<ProjectorMsg>) => {
      const m = e.data;
      if (m.type === "ready") {
        setProjectorSeen(true);
        const { view, votes, index } = latest.current;
        ch.postMessage({ type: "goto", index, view, votes } satisfies PanelMsg);
      } else if (m.type === "video:state") {
        setVideo({ filmId: m.filmId, t: m.t, d: m.d, paused: m.paused, ended: m.ended });
      } else if (m.type === "video:source") {
        setSources((s) => ({ ...s, [m.filmId]: m.source }));
      }
    };
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, [id]);

  // Manda o passo atual ao projetor sempre que mudar.
  useEffect(() => {
    post({ type: "goto", index, view, votes: latest.current.votes });
    try {
      sessionStorage.setItem(storeKey(id), String(index));
    } catch {}
  }, [index, view, id, post]);

  useEffect(() => {
    post({ type: "count", votes });
  }, [votes, post]);

  // ---------------------------------------------------------------- contador de votos
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/votacao", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { stats: Record<string, { votes: number; status: typeof status }> };
        const s = json.stats[id];
        if (alive && s) {
          setVotes(s.votes);
          setStatus(s.status);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      }
    };
    void tick();
    const t = setInterval(tick, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [id]);

  // ---------------------------------------------------------------- filmes baixados?
  useEffect(() => {
    let alive = true;
    void (async () => {
      const out: Record<string, "ok" | "incompleto" | "falta"> = {};
      for (const f of show.films) {
        const file = await readFile(filmPath(f.id));
        out[f.id] = !file || file.size === 0 ? "falta" : f.sizeBytes && file.size !== f.sizeBytes ? "incompleto" : "ok";
      }
      if (alive) setOffline(out);
    })();
    return () => {
      alive = false;
    };
  }, [show.films]);

  // ---------------------------------------------------------------- trilha
  const soundtrack = useMemo(() => {
    const cache = new Map<Cue, string | null>();
    return new Soundtrack(async (cue) => {
      if (cache.has(cue)) return cache.get(cue)!;
      const track = show.tracks.find((t) => t.cue === cue);
      const url = track ? ((await objectUrl(trackPath(track.id))) ?? track.url) : null;
      cache.set(cue, url);
      return url;
    });
  }, [show.tracks]);
  useEffect(() => () => soundtrack.dispose(), [soundtrack]);
  const audio = useSyncExternalStore(
    (fn) => soundtrack.subscribe(fn),
    () => `${soundtrack.ready}|${soundtrack.current?.cue ?? ""}|${soundtrack.current?.source ?? ""}|${soundtrack.muted}|${soundtrack.volume}`,
    () => "",
  );
  const [audioReady, audioCue, audioSource, audioMuted] = audio.split("|");

  useEffect(() => {
    void soundtrack.play(cueFor(step));
  }, [step, soundtrack]);

  // ---------------------------------------------------------------- navegação
  const flash = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    setTimeout(() => setToast((t) => (t?.text === text ? null : t)), 4500);
  }, []);

  const loadPc = useCallback(
    async (close: boolean) => {
      setBusy(true);
      try {
        const r = close ? await closeVotingFromTelao(id) : await fetchPeoplesChoice(id);
        if (!r.ok) return flash(r.error, true);
        setStatus(r.status);
        if (r.pc) setPc(r.pc);
        if (close) flash("Votação encerrada. Resultado do People's Choice carregado.");
      } catch {
        flash("Sem internet: não foi possível falar com o servidor. Tente de novo (botão no painel).", true);
      } finally {
        setBusy(false);
      }
    },
    [id, flash],
  );

  const goTo = useCallback(
    (i: number) => {
      const next = Math.max(0, Math.min(steps.length - 1, i));
      if (next === index) return;
      const target = steps[next];
      const encIdx = steps.findIndex((s) => s.kind === "encerrada");
      // Ao passar por "Votação encerrada", encerra a votação (docs/05).
      if (index < encIdx && next >= encIdx && status !== "closed") void loadPc(true);
      else if (!pc && status === "closed" && "code" in target && target.code === "pc") void loadPc(false);
      setIndex(next);
    },
    [index, steps, status, pc, loadPc],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("input, textarea, select")) return;
      soundtrack.unlock();
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        e.preventDefault();
        goTo(index + 1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        goTo(index - 1);
      } else if (e.key.toLowerCase() === "m") {
        soundtrack.setMuted(!soundtrack.muted);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, index, soundtrack]);

  // ---------------------------------------------------------------- projetor
  async function openProjector() {
    soundtrack.unlock();
    const url = `/telao/${id}/projetor`;
    let features = "popup,width=1280,height=720";
    try {
      if ("getScreenDetails" in window) {
        const details = await (window as unknown as { getScreenDetails: () => Promise<ScreenDetailsLite> }).getScreenDetails();
        const other = details.screens.find((s) => s !== details.currentScreen);
        if (other) features = `popup,left=${other.availLeft},top=${other.availTop},width=${other.availWidth},height=${other.availHeight}`;
      }
    } catch {
      /* permissão negada: abre normal e arrasta */
    }
    window.open(url, `projetor-${id}`, features);
  }

  // ---------------------------------------------------------------- render
  const next = steps[index + 1];
  const encIdx = steps.findIndex((s) => s.kind === "encerrada");
  const award = "code" in step ? (step.code === "pc" ? pc : show.awards.find((a) => a.code === step.code)) : null;
  const filmStep = step.kind === "filme" || step.kind === "cartela" ? show.films.find((f) => f.id === step.filmId) : null;
  const warnings = [
    !show.juryClosed && "A avaliação do júri ainda está aberta (Admin → Júri → encerrar).",
    ...show.awards.filter((a) => a.warning).map((a) => `${a.en}: ${a.warning}`),
    ...show.films.filter((f) => offline[f.id] && offline[f.id] !== "ok").map((f) => `"${f.title}" não está baixado neste computador (vai tocar pela internet).`),
  ].filter(Boolean) as string[];

  return (
    <div className="min-h-screen bg-background p-4 text-foreground" onPointerDown={() => soundtrack.unlock()}>
      <div className="mx-auto grid max-w-[1400px] gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* ------------ coluna de controle */}
        <aside className="space-y-4">
          <div className="card space-y-3 p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-gold">Telão · painel</p>
                <h1 className="font-display text-xl">{show.ceremony.name}</h1>
              </div>
              <Clock startedAt={startedAt} onReset={() => setStartedAt(Date.now())} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn" onClick={openProjector}>
                {projectorSeen ? "Reabrir projetor" : "Abrir projetor"}
              </button>
              <Link href="/admin/telao" className="btn-ghost">
                Sair
              </Link>
            </div>
            {!projectorSeen && (
              <p className="text-xs text-muted">
                Abra o projetor, arraste a janela para a 2ª tela (se não abrir lá sozinha) e clique nela para tela cheia.
              </p>
            )}
          </div>

          <div className="card space-y-3 p-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">
                Agora · {index + 1} de {steps.length}
              </p>
              <p className="text-lg font-semibold">{stepLabel(show, step)}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Próximo</p>
              <p>{next ? stepLabel(show, next) : "Fim do roteiro"}</p>
              {next?.kind === "encerrada" && status !== "closed" && (
                <p className="text-xs text-amber-300">Ao avançar, a votação desta cerimônia é encerrada.</p>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-ghost" disabled={index === 0} onClick={() => goTo(index - 1)}>
                ← Voltar
              </button>
              <button type="button" className="btn flex-1" disabled={!next || busy} onClick={() => goTo(index + 1)}>
                Avançar →
              </button>
            </div>
            <p className="text-xs text-muted">Teclas: → / Espaço avança · ← volta · M silencia a trilha. O passador de slides funciona.</p>
          </div>

          {step.kind === "filme" && filmStep && (
            <FilmControls
              film={filmStep}
              video={video?.filmId === filmStep.id ? video : null}
              source={sources[filmStep.id]}
              offline={offline[filmStep.id]}
              post={post}
            />
          )}

          <div className="card space-y-2 p-4">
            <div className="flex items-center justify-between">
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${status === "open" ? "bg-emerald-500/15 text-emerald-300" : status === "closed" ? "bg-gold/15 text-gold" : "bg-white/5 text-muted"}`}
              >
                Votação {status === "open" ? "aberta" : status === "closed" ? "encerrada" : "não aberta"}
              </span>
              <span className="tabular-nums">
                <b className="text-lg">{votes ?? "—"}</b> votos{stale && <span className="ml-1 text-xs text-amber-300">(desatualizado)</span>}
              </span>
            </div>
            {status === "closed" && !pc && (
              <button type="button" className="btn-ghost w-full" disabled={busy} onClick={() => loadPc(false)}>
                Buscar resultado do People&apos;s Choice
              </button>
            )}
            {status !== "closed" && index > encIdx && (
              <button type="button" className="btn w-full" disabled={busy} onClick={() => loadPc(true)}>
                Encerrar votação e buscar resultado
              </button>
            )}
          </div>

          {"code" in step && (
            <div className="space-y-1 rounded-lg border border-dashed border-gold/50 p-3 text-sm">
              <p className="text-xs uppercase tracking-[0.2em] text-gold">Só você vê</p>
              {step.code === "pc" && !pc ? (
                <p>{status === "closed" ? "Resultado ainda não carregado." : "Votação ainda aberta: o vencedor sai quando ela for encerrada."}</p>
              ) : award ? (
                <>
                  {award.secret.length ? award.secret.map((s) => <p key={s}>🏆 {s}</p>) : <p>Sem vencedor definido.</p>}
                  {award.warning && <p className="text-red-300">{award.warning}</p>}
                </>
              ) : null}
            </div>
          )}

          <SoundPanel
            soundtrack={soundtrack}
            ready={audioReady === "true"}
            cue={(audioCue || null) as Cue | null}
            source={audioSource}
            muted={audioMuted === "true"}
            step={step}
          />
        </aside>

        {/* ------------ miniatura + roteiro */}
        <section className="space-y-4">
          <div>
            <p className="mb-1 text-xs uppercase tracking-[0.2em] text-muted">Projetor · o que a plateia vê</p>
            <div className="overflow-hidden rounded-lg border border-gold/20">
              <Stage view={view} votes={votes} />
            </div>
            {step.kind === "vencedor" && (
              <p className="mt-1 text-xs text-muted">A tela fica no vencedor até você avançar: dá tempo de entregar o troféu e tirar foto.</p>
            )}
          </div>

          {warnings.length > 0 && (
            <ul className="space-y-1 rounded-lg border border-amber-400/30 bg-amber-400/5 p-3 text-sm text-amber-200">
              {warnings.map((w) => (
                <li key={w}>⚠ {w}</li>
              ))}
            </ul>
          )}

          <ol className="card max-h-[45vh] overflow-auto text-sm">
            {steps.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => goTo(i)}
                  className={`flex w-full gap-3 border-b border-gold/10 px-3 py-1.5 text-left ${i === index ? "bg-gold/15 font-semibold" : "text-muted hover:bg-white/5"}`}
                  ref={i === index ? (el) => el?.scrollIntoView({ block: "nearest" }) : undefined}
                >
                  <span className="w-6 shrink-0 tabular-nums">{i + 1}</span>
                  {stepLabel(show, s)}
                </button>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 left-1/2 z-50 max-w-[calc(100%-2rem)] -translate-x-1/2 rounded-md px-4 py-2 text-sm shadow-lg ${toast.bad ? "bg-red-900 text-red-100" : "bg-foreground text-background"}`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

type ScreenLite = { availLeft: number; availTop: number; availWidth: number; availHeight: number };
type ScreenDetailsLite = { screens: ScreenLite[]; currentScreen: ScreenLite };

function Clock({ startedAt, onReset }: { startedAt: number; onReset: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.floor((now - startedAt) / 1000));
  return (
    <button type="button" title="Zerar cronômetro" onClick={onReset} className="font-mono text-lg tabular-nums text-muted hover:text-foreground">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </button>
  );
}

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
const SOURCE_LABEL: Record<FilmSource, string> = {
  offline: "▶ Tocando do disco (offline)",
  pendrive: "▶ Tocando do arquivo escolhido (pendrive)",
  internet: "▶ Tocando pela internet (Drive)",
  erro: "✖ Não foi possível tocar",
};

function FilmControls({
  film,
  video,
  source,
  offline,
  post,
}: {
  film: Show["films"][number];
  video: VideoState | null;
  source: FilmSource | undefined;
  offline: "ok" | "incompleto" | "falta" | undefined;
  post: (m: PanelMsg) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="card space-y-3 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-muted">Filme</p>
      <p className={`text-sm ${source === "erro" ? "text-red-300" : source === "internet" ? "text-amber-300" : "text-emerald-300"}`}>
        {source ? SOURCE_LABEL[source] : "Aguardando o projetor…"}
      </p>
      {video && video.d > 0 && (
        <div>
          <div className="h-1.5 overflow-hidden rounded bg-white/10">
            <div className="h-full bg-gold" style={{ width: `${(video.t / video.d) * 100}%` }} />
          </div>
          <p className="mt-1 text-xs tabular-nums text-muted">
            {fmtTime(video.t)} / {fmtTime(video.d)} {video.ended && <b className="text-gold">· terminou: avance (→)</b>}
          </p>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => post({ type: "video", cmd: video?.paused ? "play" : "pause" })}>
          {video?.paused ? "▶ Tocar" : "⏸ Pausar"}
        </button>
        <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => post({ type: "video", cmd: "seek", t: -10 })}>
          −10 s
        </button>
        <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => post({ type: "video", cmd: "seek", t: 10 })}>
          +10 s
        </button>
        <button
          type="button"
          className="btn-ghost px-3 py-1 text-xs"
          onClick={() => window.confirm("Recomeçar o filme do início?") && post({ type: "video", cmd: "restart" })}
        >
          ⟲ Do início
        </button>
      </div>
      {(source === "erro" || source === "internet" || offline !== "ok") && (
        <div className="space-y-1 border-t border-gold/10 pt-2">
          <p className="text-xs text-muted">Plano B: tocar o arquivo do pendrive.</p>
          <input
            ref={inputRef}
            type="file"
            accept="video/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) post({ type: "localFile", filmId: film.id, file: f });
              e.target.value = "";
            }}
          />
          <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => inputRef.current?.click()}>
            Escolher arquivo de “{film.title}”
          </button>
        </div>
      )}
    </div>
  );
}

function SoundPanel({
  soundtrack,
  ready,
  cue,
  source,
  muted,
  step,
}: {
  soundtrack: Soundtrack;
  ready: boolean;
  cue: Cue | null;
  source: string;
  muted: boolean;
  step: Step;
}) {
  const silentStep = step.kind === "cartela" || step.kind === "filme";
  return (
    <div className="card space-y-2 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Trilha sonora</p>
        <span className="text-xs text-muted">M = silenciar</span>
      </div>
      {!ready ? (
        <button type="button" className="btn w-full" onClick={() => soundtrack.unlock()}>
          🔊 Clique para ativar o som
        </button>
      ) : (
        <p className="text-sm font-semibold">
          {cue ? `♪ ${CUES[cue].name} · ${source === "arquivo" ? "arquivo de vocês" : "exemplo clássico"}` : "Silêncio"}
          {muted && " (silenciada)"}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => soundtrack.setMuted(!soundtrack.muted)}>
          {muted ? "🔇 Ligar" : "🔊 Silenciar"}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          defaultValue={soundtrack.volume}
          onChange={(e) => soundtrack.setVolume(Number(e.target.value))}
          aria-label="Volume da trilha"
          className="min-w-0 flex-1 accent-[var(--gold)]"
        />
      </div>
      {silentStep && <p className="text-xs text-muted">Silêncio: o filme tem áudio próprio.</p>}
    </div>
  );
}
