"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { BallotFilm } from "@/lib/urna";
import { castVote, checkVoteCode, loadBallot, pairUrna, type UrnaState } from "./actions";

type Screen =
  | { name: "code" }
  | { name: "ballot"; code: string }
  | { name: "confirm"; code: string; film: BallotFilm }
  | { name: "done" };

const IDLE_MS = 60_000; // volta ao início se o aluno abandonar a cédula
const DONE_MS = 4_000;

export function UrnaApp({ initial }: { initial: UrnaState }) {
  const [state, setState] = useState<UrnaState>(initial);

  // Consulta o estado (votação aberta/fechada, cerimônia) a cada 3 s.
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/urna/estado", { cache: "no-store" });
        if (res.ok && alive) setState(await res.json());
      } catch {
        // sem rede: mantém o último estado
      }
    };
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <main className="flex min-h-screen flex-1 flex-col bg-background">
      {!state.paired ? (
        <PairScreen onPaired={() => location.reload()} />
      ) : !state.ceremony ? (
        <Centered title="Urna sem cerimônia" subtitle={`${state.label} · A organização precisa escolher a cerimônia no painel.`} />
      ) : state.ceremony.status !== "open" ? (
        <Centered
          title={state.ceremony.status === "closed" ? "Votação encerrada" : "Votação ainda não aberta"}
          subtitle={`${state.ceremony.name} · ${state.label}`}
          note={state.ceremony.status === "closed" ? "Obrigado por participar!" : "Aguarde a organização abrir a votação."}
        />
      ) : (
        <VotingFlow key={state.ceremony.id} ceremony={state.ceremony} label={state.label} />
      )}
    </main>
  );
}

// ---------------------------------------------------------------- votação

function VotingFlow({ ceremony, label }: { ceremony: { id: string; name: string; prefix: string }; label: string }) {
  const [screen, setScreen] = useState<Screen>({ name: "code" });
  const [films, setFilms] = useState<BallotFilm[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const triedVote = useRef(false);

  useEffect(() => {
    loadBallot().then(setFilms).catch(() => setFilms([]));
  }, [ceremony.id]);

  const reset = useCallback(() => {
    setScreen({ name: "code" });
    setError(null);
    triedVote.current = false;
  }, []);

  // Inatividade na cédula/confirmação e tela de agradecimento.
  useEffect(() => {
    if (screen.name === "code") return;
    const t = setTimeout(reset, screen.name === "done" ? DONE_MS : IDLE_MS);
    return () => clearTimeout(t);
  }, [screen, reset]);

  function submitCode(input: string) {
    setError(null);
    startTransition(async () => {
      try {
        const r = await checkVoteCode(input, ceremony.prefix);
        if (r.ok) setScreen({ name: "ballot", code: r.code });
        else setError(r.message);
      } catch {
        setError("Falha de conexão. Tente de novo.");
      }
    });
  }

  function confirmVote(code: string, film: BallotFilm) {
    setError(null);
    startTransition(async () => {
      try {
        const r = await castVote(code, film.id);
        if (r.ok) {
          setScreen({ name: "done" });
        } else if (r.reason === "used" && triedVote.current) {
          // A tentativa anterior pode ter chegado ao servidor antes de a conexão cair.
          setError("Este código já foi usado — seu voto provavelmente foi registrado na tentativa anterior. Chame a organização se tiver dúvida.");
        } else {
          setError(r.message);
          if (r.reason !== "invalid_film") setScreen({ name: "code" });
        }
      } catch {
        triedVote.current = true;
        setError("Falha de conexão. Toque em Confirmar de novo.");
      }
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-gold/20 px-6 py-4">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-gold">People&apos;s Choice</p>
          <p className="font-display text-xl">{ceremony.name}</p>
        </div>
        <p className="text-sm text-muted">{label}</p>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        {screen.name === "code" && (
          <CodeScreen prefix={ceremony.prefix} pending={pending} error={error} onSubmit={submitCode} />
        )}

        {screen.name === "ballot" && (
          <div className="w-full max-w-5xl space-y-6">
            <h1 className="text-center font-display text-3xl">Escolha o seu filme favorito</h1>
            {films === null ? (
              <p className="text-center text-muted">Carregando filmes…</p>
            ) : (
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                {films.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setScreen({ name: "confirm", code: screen.code, film: f })}
                    className="card group overflow-hidden text-left transition hover:border-gold focus:border-gold focus:outline-none"
                  >
                    <Poster film={f} />
                    <div className="p-3">
                      <p className="font-medium">{f.title}</p>
                      {f.class_name && <p className="text-xs text-muted">{f.class_name}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <div className="text-center">
              <button type="button" className="btn-ghost" onClick={reset}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {screen.name === "confirm" && (
          <div className="w-full max-w-md space-y-6 text-center">
            <h1 className="font-display text-3xl">Confirmar voto?</h1>
            <div className="mx-auto w-48">
              <div className="card overflow-hidden">
                <Poster film={screen.film} />
              </div>
            </div>
            <p className="font-display text-2xl text-gold">{screen.film.title}</p>
            {error && <p role="alert" className="text-red-300">{error}</p>}
            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="btn-ghost px-6 py-3 text-base"
                disabled={pending}
                onClick={() => setScreen({ name: "ballot", code: screen.code })}
              >
                Voltar
              </button>
              <button
                type="button"
                className="btn px-8 py-3 text-base"
                disabled={pending}
                onClick={() => confirmVote(screen.code, screen.film)}
              >
                {pending ? "Registrando…" : "Confirmar"}
              </button>
            </div>
          </div>
        )}

        {screen.name === "done" && (
          <div className="space-y-4 text-center">
            <p className="text-6xl">🎬</p>
            <h1 className="font-display text-4xl text-gold">Voto registrado!</h1>
            <p className="text-muted">Obrigado por participar. Passe a vez para o próximo colega.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function CodeScreen({
  prefix,
  pending,
  error,
  onSubmit,
}: {
  prefix: string;
  pending: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");

  // Mantém o foco no campo (quiosque com teclado físico).
  useEffect(() => {
    inputRef.current?.focus();
  }, [pending, error]);

  // Limpa o campo quando o código é recusado.
  const [handledError, setHandledError] = useState(error);
  if (error !== handledError) {
    setHandledError(error);
    if (error) setValue("");
  }

  return (
    <form
      className="w-full max-w-md space-y-6 text-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value);
      }}
    >
      <h1 className="font-display text-4xl">Digite o código do seu cartão</h1>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value.toUpperCase())}
        placeholder={`${prefix}-XXXX`}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        maxLength={12}
        className="input py-4 text-center font-mono text-4xl tracking-[0.3em]"
        aria-label="Código do cartão"
        disabled={pending}
      />
      {error && (
        <p role="alert" className="text-lg text-red-300">
          {error}
        </p>
      )}
      <button type="submit" className="btn w-full py-4 text-lg" disabled={pending || !value.trim()}>
        {pending ? "Conferindo…" : "Continuar"}
      </button>
    </form>
  );
}

function Poster({ film }: { film: BallotFilm }) {
  return (
    <div className="flex aspect-[2/3] w-full items-center justify-center bg-background text-4xl">
      {film.posterUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- URL assinada do Storage
        <img src={film.posterUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        "🎬"
      )}
    </div>
  );
}

// ---------------------------------------------------------------- telas simples

function Centered({ title, subtitle, note }: { title: string; subtitle: string; note?: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
      <p className="text-xs uppercase tracking-[0.3em] text-gold">People&apos;s Choice</p>
      <h1 className="mt-3 font-display text-5xl">{title}</h1>
      <p className="mt-4 text-muted">{subtitle}</p>
      {note && <p className="mt-2 text-muted">{note}</p>}
    </div>
  );
}

function PairScreen({ onPaired }: { onPaired: () => void }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-1 items-center justify-center px-4">
      <form
        className="card w-full max-w-sm space-y-4 p-8"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          startTransition(async () => {
            const r = await pairUrna(value);
            if (r.ok) onPaired();
            else setError(r.error);
          });
        }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Configurar urna</p>
        <h1 className="font-display text-2xl">Parear este computador</h1>
        <p className="text-sm text-muted">
          No painel do admin, em Votação → Urnas, gere um código de pareamento e digite aqui.
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX"
          className="input py-3 text-center font-mono text-2xl tracking-widest"
          autoComplete="off"
          aria-label="Código de pareamento"
        />
        {error && <p className="text-sm text-red-300">{error}</p>}
        <button className="btn w-full" disabled={pending || !value.trim()}>
          {pending ? "Pareando…" : "Parear"}
        </button>
      </form>
    </div>
  );
}
