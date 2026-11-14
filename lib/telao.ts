// Lógica do telão (roteiro, indicados, o que o projetor mostra).
// Sem "server-only": usada no servidor (montar o show) e no painel (cliente).
import type { CategoryResult, PeoplesChoiceResult } from "@/lib/results";

export type Cue = "abertura" | "bastidores" | "ambiente" | "suspense" | "fanfarra" | "fanfarra_pc" | "encerramento";

export type ShowFilm = {
  id: string;
  title: string;
  className: string | null;
  posterUrl: string | null;
  driveFileId: string | null;
  sizeBytes: number | null;
  durationMs: number | null;
};

/** Cartão de um filme no projetor (sem dados internos). */
export type FilmCard = { id: string; title: string; className: string | null; posterUrl: string | null };

export type Nominee = { ref: string; label: string; sublabel: string; film: FilmCard };

export type Award = {
  code: string;
  en: string;
  pt: string;
  isPublic: boolean;
  /** em ordem aleatória fixa (docs/05) */
  nominees: Nominee[];
  winners: Nominee[];
  /** "Só você vê": vencedor com média ou votos */
  secret: string[];
  warning: string | null;
};

export type ShowTrack = { id: string; cue: Cue; url: string | null; fileName: string | null };

export type Show = {
  ceremony: {
    id: string;
    name: string;
    shortName: string;
    votingStatus: "not_started" | "open" | "closed";
  };
  editionName: string;
  juryClosed: boolean;
  nextCeremony: { name: string; startsAt: string | null } | null;
  films: ShowFilm[];
  awards: Award[];
  pcInfo: { en: string; pt: string };
  pc: Award | null;
  tracks: ShowTrack[];
};

// ------------------------------------------------------------------ sorteio fixo

function hash(s: string) {
  let h = 2166136261;
  for (const ch of s) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Embaralha sempre do mesmo jeito para a mesma semente. */
export function seededShuffle<T>(list: T[], seed: string): T[] {
  const r = rng(hash(seed));
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Até 3 indicados: os primeiros do ranking. Vencedores fora do top 3
 * (desempate) entram no lugar dos últimos. Ordem aleatória fixa.
 */
export function pickNominees<T extends { ref: string }>(ranked: T[], winnerRefs: string[], seed: string): T[] {
  const top = ranked.slice(0, 3);
  const missing = ranked.filter((r) => winnerRefs.includes(r.ref) && !top.includes(r));
  for (const w of missing) {
    const idx = top.findLastIndex((t) => !winnerRefs.includes(t.ref));
    if (idx >= 0) top[idx] = w;
    else top.push(w);
  }
  return seededShuffle(top, seed);
}

const fmtAvg = (v: number | null) => (v == null ? "—" : v.toFixed(2).replace(".", ","));

// ------------------------------------------------------------------ prêmios

export function juryAward(result: CategoryResult, films: ShowFilm[], ceremonyId: string): Award {
  const card = (filmId: string) => toCard(films.find((f) => f.id === filmId));
  const ranked = result.rows.filter((r) => r.avg != null);
  const toNominee = (r: (typeof ranked)[number]): Nominee => ({
    ref: r.ref,
    label: r.label,
    // filme: turma · atuação: "personagem · filme"
    sublabel: r.sublabel ?? "",
    film: card(r.filmId),
  });
  const nominees = pickNominees(ranked, result.winnerRefs, `${ceremonyId}:${result.category.code}`).map(toNominee);
  const winners = ranked.filter((r) => result.winnerRefs.includes(r.ref)).map(toNominee);

  let warning: string | null = null;
  if (!ranked.length) warning = "Sem notas do júri nesta categoria.";
  else if (result.unresolvedTie) warning = "Empate não resolvido: decida em Júri → desempate antes de revelar.";

  const secret = winners.length
    ? winners.map((w) => {
        const row = ranked.find((r) => r.ref === w.ref);
        return `${w.label}${result.category.kind === "acting" ? ` (${w.film.title})` : ""} · média ${fmtAvg(row?.avg ?? null)}`;
      })
    : [];

  return {
    code: result.category.code,
    en: result.category.name_en,
    pt: result.category.name_pt,
    isPublic: false,
    nominees,
    winners,
    secret,
    warning,
  };
}

const DECIDED_BY = {
  votes: "",
  best_picture: " · desempate: média do júri em Melhor Filme",
  jury_overall: " · desempate: média geral do júri",
  shared: " · empate total: prêmio dividido",
} as const;

export function peoplesChoiceAward(
  pc: PeoplesChoiceResult,
  films: ShowFilm[],
  info: { en: string; pt: string },
  ceremonyId: string,
): Award {
  const ranked = pc.rows.map((r) => ({ ref: r.filmId, votes: r.votes }));
  const toNominee = (ref: string): Nominee => {
    const f = films.find((x) => x.id === ref);
    return { ref, label: f?.title ?? "?", sublabel: f?.className ?? "", film: toCard(f) };
  };
  const nominees = pc.totalVotes
    ? pickNominees(ranked, pc.winnerRefs, `${ceremonyId}:pc`).map((r) => toNominee(r.ref))
    : [];
  const winners = pc.winnerRefs.map(toNominee);
  return {
    code: "pc",
    en: info.en,
    pt: info.pt,
    isPublic: true,
    nominees,
    winners,
    secret: winners.map((w) => {
      const v = pc.rows.find((r) => r.filmId === w.ref)?.votes ?? 0;
      return `${w.label} · ${v} voto${v === 1 ? "" : "s"} de ${pc.totalVotes}${pc.decidedBy ? DECIDED_BY[pc.decidedBy] : ""}`;
    }),
    warning: pc.totalVotes ? null : "Nenhum voto registrado.",
  };
}

export function toCard(f: ShowFilm | undefined): FilmCard {
  return f
    ? { id: f.id, title: f.title, className: f.className, posterUrl: f.posterUrl }
    : { id: "", title: "?", className: null, posterUrl: null };
}

// ------------------------------------------------------------------ roteiro

export type Step =
  | { kind: "abertura" }
  | { kind: "cartela"; filmId: string }
  | { kind: "filme"; filmId: string }
  | { kind: "chamada" }
  | { kind: "encerrada" }
  | { kind: "cat"; code: string }
  | { kind: "indicados"; code: string }
  | { kind: "vencedor"; code: string }
  | { kind: "fim" };

export function buildSteps(show: Show): Step[] {
  const steps: Step[] = [{ kind: "abertura" }];
  for (const f of show.films) steps.push({ kind: "cartela", filmId: f.id }, { kind: "filme", filmId: f.id });
  steps.push({ kind: "chamada" }, { kind: "encerrada" });
  for (const code of [...show.awards.map((a) => a.code), "pc"]) {
    steps.push({ kind: "cat", code }, { kind: "indicados", code }, { kind: "vencedor", code });
  }
  steps.push({ kind: "fim" });
  return steps;
}

export function awardName(show: Show, code: string) {
  if (code === "pc") return show.pcInfo.en;
  return show.awards.find((a) => a.code === code)?.en ?? code;
}

export function stepLabel(show: Show, s: Step): string {
  const film = (id: string) => show.films.find((f) => f.id === id)?.title ?? "?";
  switch (s.kind) {
    case "abertura":
      return "Abertura";
    case "cartela":
      return `Cartela · ${film(s.filmId)}`;
    case "filme":
      return `Filme · ${film(s.filmId)}`;
    case "chamada":
      return "Chamada para votação";
    case "encerrada":
      return "Votação encerrada";
    case "cat":
      return awardName(show, s.code);
    case "indicados":
      return `Indicados · ${awardName(show, s.code)}`;
    case "vencedor":
      return `Vencedor · ${awardName(show, s.code)}`;
    case "fim":
      return "Encerramento";
  }
}

/** Faixa da trilha de cada passo (docs/05). null = silêncio. */
export function cueFor(s: Step): Cue | null {
  switch (s.kind) {
    case "abertura":
      return "abertura";
    case "chamada":
      return "bastidores";
    case "encerrada":
    case "cat":
      return "ambiente";
    case "indicados":
      return "suspense";
    case "vencedor":
      return s.code === "pc" ? "fanfarra_pc" : "fanfarra";
    case "fim":
      return "encerramento";
    default:
      return null;
  }
}

// ------------------------------------------------------------------ o que o projetor mostra

export type View =
  | { kind: "abertura"; edition: string; ceremony: string }
  | { kind: "cartela"; film: FilmCard }
  | { kind: "filme"; film: FilmCard; driveFileId: string | null }
  | { kind: "chamada"; films: FilmCard[] }
  | { kind: "encerrada" }
  | { kind: "cat"; en: string; pt: string; isPublic: boolean }
  | { kind: "indicados"; en: string; nominees: Nominee[] }
  | { kind: "vencedor"; en: string; winners: Nominee[]; isPublic: boolean }
  | { kind: "fim"; edition: string; next: string | null };

/** Monta o que o projetor desenha. Nada de notas, votos ou vencedor antes da hora. */
export function viewFor(show: Show, s: Step, pc: Award | null): View {
  const film = (id: string) => show.films.find((f) => f.id === id);
  const award = (code: string) => (code === "pc" ? pc : (show.awards.find((a) => a.code === code) ?? null));
  switch (s.kind) {
    case "abertura":
      return { kind: "abertura", edition: show.editionName, ceremony: show.ceremony.name };
    case "cartela":
      return { kind: "cartela", film: toCard(film(s.filmId)) };
    case "filme": {
      const f = film(s.filmId);
      return { kind: "filme", film: toCard(f), driveFileId: f?.driveFileId ?? null };
    }
    case "chamada":
      return { kind: "chamada", films: show.films.map(toCard) };
    case "encerrada":
      return { kind: "encerrada" };
    case "cat": {
      const a = award(s.code);
      const info = s.code === "pc" ? show.pcInfo : a;
      return { kind: "cat", en: info?.en ?? "", pt: info?.pt ?? "", isPublic: s.code === "pc" };
    }
    case "indicados": {
      const a = award(s.code);
      // Sem resultado ainda (People's Choice antes de encerrar): fica na apresentação.
      if (!a) return { kind: "cat", en: show.pcInfo.en, pt: show.pcInfo.pt, isPublic: true };
      return { kind: "indicados", en: a.en, nominees: a.nominees };
    }
    case "vencedor": {
      const a = award(s.code);
      if (!a) return { kind: "cat", en: show.pcInfo.en, pt: show.pcInfo.pt, isPublic: true };
      return { kind: "vencedor", en: a.en, winners: a.winners, isPublic: a.isPublic };
    }
    case "fim":
      return {
        kind: "fim",
        edition: show.editionName,
        next: show.nextCeremony
          ? `${show.nextCeremony.name}${show.nextCeremony.startsAt ? ` às ${show.nextCeremony.startsAt}` : ""}`
          : null,
      };
  }
}

// ------------------------------------------------------------------ mensagens painel ⇄ projetor

export type PanelMsg =
  | { type: "goto"; index: number; view: View; votes: number | null }
  | { type: "count"; votes: number | null }
  | { type: "video"; cmd: "play" | "pause" | "restart" | "seek"; t?: number }
  | { type: "localFile"; filmId: string; file: File };

export type ProjectorMsg =
  | { type: "ready" }
  | { type: "video:state"; filmId: string; t: number; d: number; paused: boolean; ended: boolean }
  | { type: "video:source"; filmId: string; source: "offline" | "pendrive" | "internet" | "erro" };

export const channelName = (ceremonyId: string) => `telao-${ceremonyId}`;
