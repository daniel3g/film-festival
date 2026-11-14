"use client";

import { useEffect, useState } from "react";
import { objectUrl, posterPath } from "@/lib/opfs";
import type { FilmCard, Nominee, View } from "@/lib/telao";

/**
 * O que a plateia vê. Usado pelo projetor (tela cheia) e pela miniatura do painel.
 * `video` é o player do passo "filme" (só o projetor passa).
 */
export function Stage({ view, votes, video }: { view: View | null; votes: number | null; video?: React.ReactNode }) {
  return (
    <div className="stage">
      {view ? <Content view={view} votes={votes} video={video} /> : <div className="pv"><span className="k">Film Festival</span></div>}
    </div>
  );
}

function Content({ view, votes, video }: { view: View; votes: number | null; video?: React.ReactNode }) {
  switch (view.kind) {
    case "abertura":
      return (
        <div className="pv" key="abertura">
          <span className="k">Bem-vindos ao</span>
          <span className="xl">{view.edition}</span>
          <span className="m">{view.ceremony}</span>
        </div>
      );
    case "cartela":
      return (
        <div className="pv" key={`cartela-${view.film.id}`}>
          <div className="cart">
            <Poster film={view.film} />
            <div style={{ display: "flex", flexDirection: "column", gap: "1.4cqw" }}>
              <span className="k">A seguir</span>
              <span className="xl" style={{ fontSize: "6cqw" }}>{view.film.title}</span>
              {view.film.className && <span className="m">Uma produção da turma {view.film.className}</span>}
            </div>
          </div>
        </div>
      );
    case "filme":
      return video ? (
        <div className="video">{video}</div>
      ) : (
        <div className="video">
          <span className="msg">▶ {view.film.title}</span>
        </div>
      );
    case "chamada":
      return (
        <div className="pv" key="chamada">
          <span className="k">People&apos;s Choice Award</span>
          <span className="l">Hora de votar!</span>
          <span className="m">Pegue seu cartão com o código e vá até uma das urnas</span>
          {votes != null && (
            <>
              <span className="count">{votes}</span>
              <span className="m" style={{ marginTop: "-1cqw" }}>voto{votes === 1 ? "" : "s"} registrado{votes === 1 ? "" : "s"}</span>
            </>
          )}
          {view.films.length > 0 && (
            <div className="stripwrap">
              <div className="strip">
                {Array.from({ length: Math.max(2, Math.ceil(16 / view.films.length)) * 2 }, () => view.films)
                  .flat()
                  .map((f, i) => (
                    <Poster key={i} film={f} />
                  ))}
              </div>
            </div>
          )}
        </div>
      );
    case "encerrada":
      return (
        <div className="pv" key="encerrada">
          <span className="k">People&apos;s Choice Award</span>
          <span className="l">Votação encerrada</span>
          <span className="m">{votes != null ? `${votes} votos registrados. ` : ""}Obrigado!</span>
        </div>
      );
    case "cat":
      return (
        <div className="pv" key={`cat-${view.en}`}>
          <span className="k">{view.isPublic ? "O prêmio do público" : "Prêmio do júri técnico"}</span>
          <span className="xl">{view.en}</span>
          <span className="m">{view.pt}</span>
        </div>
      );
    case "indicados":
      return (
        <div className="pv" key={`ind-${view.en}`}>
          <span className="k">{view.en}</span>
          <span className="l">{view.nominees.length === 1 ? "O indicado é" : "Os indicados são"}</span>
          <div className="row">
            {view.nominees.map((n) => (
              <NomineeCard key={n.ref} n={n} />
            ))}
          </div>
        </div>
      );
    case "vencedor":
      return (
        <div className="pv win" key={`win-${view.en}`}>
          <span className="k">{view.en}</span>
          <span className="m" style={{ fontStyle: "italic" }}>
            And the award goes to…
          </span>
          <div className="wins">
            {view.winners.map((w) => (
              <div key={w.ref} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.2cqw" }}>
                <Poster film={w.film} />
                <span className={`${view.winners.length > 1 ? "l" : "xl"} shine`} style={{ fontSize: view.winners.length > 1 ? "3.6cqw" : "5cqw" }}>
                  {w.label}
                </span>
                <span className="m">{winnerSub(w)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "fim":
      return (
        <div className="pv" key="fim">
          <span className="xl">Obrigado!</span>
          <span className="l gold">{view.edition}</span>
          <span className="m">{view.next ? `Próxima sessão: ${view.next}` : "Até a próxima edição"}</span>
        </div>
      );
  }
}

function winnerSub(w: Nominee) {
  // filme: turma · atuação: personagem · filme
  if (w.label === w.film.title) return w.film.className ? `Turma ${w.film.className}` : "";
  return w.sublabel;
}

function NomineeCard({ n }: { n: Nominee }) {
  return (
    <div className="nom">
      <Poster film={n.film} />
      <span className="nm">{n.label}</span>
      <span className="ns">{n.sublabel}</span>
    </div>
  );
}

/** Pôster: primeiro o baixado (offline), depois a URL; sem nenhum, o título. */
export function Poster({ film }: { film: FilmCard }) {
  const [local, setLocal] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    let url: string | null = null;
    let alive = true;
    void objectUrl(posterPath(film.id)).then((u) => {
      if (alive) setLocal((url = u));
      else if (u) URL.revokeObjectURL(u);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [film.id]);

  const src = local ?? (broken ? null : film.posterUrl);
  return (
    <div className="poster">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- arquivo local (blob) ou URL assinada
        <img src={src} alt="" onError={() => !local && setBroken(true)} />
      ) : (
        <span className="pt">{film.title}</span>
      )}
    </div>
  );
}
