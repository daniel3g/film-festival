import "server-only";
import type { SupabaseServer } from "@/lib/admin";
import { getJuryCategories, scoreItemsFor, type Category, type CastLite } from "@/lib/jury";

/** Diferença abaixo disso conta como empate (docs/05). */
export const TIE_EPSILON = 0.005;

export type Candidate = {
  ref: string; // id do filme (categorias de filme) ou do integrante (atuação)
  label: string;
  sublabel: string;
  filmId: string;
};

export type RankRow = Candidate & { avg: number | null; votes: number; position: number | null };

export type TiebreakInfo = {
  id: string;
  status: "open" | "decided";
  tiedRefs: string[];
  winnerRef: string | null;
  method: "majority" | "casting_vote" | null;
  /** votos válidos por candidato */
  counts: Record<string, number>;
  voters: number;
  /** vencedor por maioria simples, se houver um único mais votado */
  majorityRef: string | null;
};

export type CategoryResult = {
  ceremonyId: string;
  category: Category;
  rows: RankRow[];
  /** refs empatados no 1º lugar (2 ou mais), ou null */
  tiedRefs: string[] | null;
  tiebreak: TiebreakInfo | null;
  /** vencedor(es) definidos; vazio se não há notas ou o empate não foi resolvido */
  winnerRefs: string[];
  unresolvedTie: boolean;
};

export type FilmLite = {
  id: string;
  title: string;
  class_name: string | null;
  screening_order: number;
  cast_members: CastLite[];
};
export type CeremonyLite = { id: string; name: string; sort_order: number; films: FilmLite[] };

export type JuryData = Awaited<ReturnType<typeof loadJuryData>>;

/** Carrega tudo o que o painel do júri precisa (cliente do admin: vê todas as notas). */
export async function loadJuryData(supabase: SupabaseServer) {
  const [{ data: edition }, { data: ceremonies }, categories, { data: jurors }, { data: scores }, { data: tiebreaks }] =
    await Promise.all([
      supabase.from("editions").select("id, name, jury_status").eq("is_active", true).maybeSingle(),
      supabase
        .from("ceremonies")
        .select(
          "id, name, sort_order, editions!inner(is_active), films(id, title, class_name, screening_order, cast_members(id, student_name, role_name, is_evaluated, acting_category, sort_order))",
        )
        .eq("editions.is_active", true)
        .order("sort_order")
        .order("screening_order", { referencedTable: "films" }),
      getJuryCategories(supabase),
      supabase.from("jurors").select("id, name, email, user_id, editions!inner(is_active)").eq("editions.is_active", true).order("created_at"),
      supabase.from("scores").select("juror_id, category_id, film_id, cast_member_id, value"),
      supabase.from("tiebreaks").select("id, ceremony_id, category_id, tied_refs, status, winner_ref, method, tiebreak_votes(juror_id, choice_ref)"),
    ]);

  const cers: CeremonyLite[] = (ceremonies ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    sort_order: c.sort_order,
    films: c.films.map((f) => ({
      id: f.id,
      title: f.title,
      class_name: f.class_name,
      screening_order: f.screening_order,
      cast_members: [...f.cast_members].sort((a, b) => a.sort_order - b.sort_order),
    })),
  }));

  return {
    edition,
    ceremonies: cers,
    categories,
    jurors: (jurors ?? []).map((j) => ({ id: j.id, name: j.name, email: j.email, user_id: j.user_id })),
    scores: (scores ?? []).map((s) => ({ ...s, value: Number(s.value) })),
    tiebreaks: tiebreaks ?? [],
  };
}

/** Concorrentes de uma categoria numa cerimônia. */
export function candidatesFor(category: Category, ceremony: CeremonyLite): Candidate[] {
  if (category.kind === "film") {
    return ceremony.films.map((f) => ({
      ref: f.id,
      label: f.title,
      sublabel: f.class_name ?? "",
      filmId: f.id,
    }));
  }
  if (category.kind === "acting") {
    return ceremony.films.flatMap((f) =>
      f.cast_members
        .filter((m) => m.is_evaluated && m.acting_category === category.acting_category)
        .map((m) => ({
          ref: m.id,
          label: m.student_name,
          sublabel: `${m.role_name ? `${m.role_name} · ` : ""}${f.title}`,
          filmId: f.id,
        })),
    );
  }
  return [];
}

/** Calcula médias, ranking, empates e vencedores por cerimônia e categoria. */
export function computeJuryResults(data: JuryData): CategoryResult[] {
  const out: CategoryResult[] = [];
  const validJurors = new Set(data.jurors.map((j) => j.id));

  for (const ceremony of data.ceremonies) {
    for (const category of data.categories) {
      const candidates = candidatesFor(category, ceremony);
      if (!candidates.length) continue;

      const rows: RankRow[] = candidates.map((c) => {
        const values = data.scores
          .filter(
            (s) =>
              validJurors.has(s.juror_id) &&
              s.category_id === category.id &&
              (category.kind === "acting" ? s.cast_member_id === c.ref : s.film_id === c.ref && !s.cast_member_id),
          )
          .map((s) => s.value);
        // Média só entre os jurados que deram nota (docs/05).
        const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
        return { ...c, avg, votes: values.length, position: null };
      });

      rows.sort((a, b) => (b.avg ?? -1) - (a.avg ?? -1));
      let lastAvg: number | null = null;
      let lastPos = 0;
      rows.forEach((r, i) => {
        if (r.avg === null) return;
        if (lastAvg === null || lastAvg - r.avg >= TIE_EPSILON) {
          lastPos = i + 1;
          lastAvg = r.avg;
        }
        r.position = lastPos;
      });

      const top = rows.filter((r) => r.position === 1);
      const tiedRefs = top.length > 1 ? top.map((r) => r.ref) : null;

      const tb = data.tiebreaks.find((t) => t.ceremony_id === ceremony.id && t.category_id === category.id);
      const tiebreak = tb ? summarizeTiebreak(tb, validJurors) : null;

      let winnerRefs: string[] = [];
      let unresolvedTie = false;
      if (tiedRefs) {
        if (tiebreak?.status === "decided" && tiebreak.winnerRef) winnerRefs = [tiebreak.winnerRef];
        else unresolvedTie = true;
      } else if (top.length === 1) {
        winnerRefs = [top[0].ref];
      }

      out.push({ ceremonyId: ceremony.id, category, rows, tiedRefs, tiebreak, winnerRefs, unresolvedTie });
    }
  }
  return out;
}

function summarizeTiebreak(
  tb: JuryData["tiebreaks"][number],
  validJurors: Set<string>,
): TiebreakInfo {
  const tiedRefs = (tb.tied_refs as string[]) ?? [];
  const counts: Record<string, number> = Object.fromEntries(tiedRefs.map((r) => [r, 0]));
  let voters = 0;
  for (const v of tb.tiebreak_votes) {
    if (!validJurors.has(v.juror_id) || !(v.choice_ref in counts)) continue;
    counts[v.choice_ref] += 1;
    voters += 1;
  }
  const max = Math.max(0, ...Object.values(counts));
  const leaders = Object.keys(counts).filter((r) => counts[r] === max);
  return {
    id: tb.id,
    status: tb.status,
    tiedRefs,
    winnerRef: tb.winner_ref,
    method: tb.method,
    counts,
    voters,
    majorityRef: max > 0 && leaders.length === 1 ? leaders[0] : null,
  };
}

export type PeoplesChoiceRow = {
  filmId: string;
  label: string;
  votes: number;
  /** média do júri em Melhor Filme */
  picAvg: number | null;
  /** média geral do júri (média das categorias de filme) */
  overallAvg: number | null;
};

export type PeoplesChoiceResult = {
  rows: PeoplesChoiceRow[]; // ordenadas por votos
  totalVotes: number;
  winnerRefs: string[];
  /** critério que definiu o vencedor (docs/05) */
  decidedBy: "votes" | "best_picture" | "jury_overall" | "shared" | null;
};

/**
 * People's Choice com desempate em cascata:
 * votos → média do júri em Melhor Filme → média geral do júri → prêmio dividido.
 */
export function computePeoplesChoice(
  ceremony: CeremonyLite,
  votesByFilm: Record<string, number>,
  jury: CategoryResult[],
): PeoplesChoiceResult {
  const juryHere = jury.filter((r) => r.ceremonyId === ceremony.id);
  const avgOf = (code: string, filmId: string) =>
    juryHere.find((r) => r.category.code === code)?.rows.find((row) => row.ref === filmId)?.avg ?? null;
  const filmCats = juryHere.filter((r) => r.category.kind === "film");

  const rows: PeoplesChoiceRow[] = ceremony.films.map((f) => {
    const avgs = filmCats
      .map((r) => r.rows.find((row) => row.ref === f.id)?.avg)
      .filter((v): v is number => v != null);
    return {
      filmId: f.id,
      label: f.title,
      votes: votesByFilm[f.id] ?? 0,
      picAvg: avgOf("pic", f.id),
      overallAvg: avgs.length ? avgs.reduce((a, b) => a + b, 0) / avgs.length : null,
    };
  });
  rows.sort((a, b) => b.votes - a.votes);

  const totalVotes = rows.reduce((a, r) => a + r.votes, 0);
  if (totalVotes === 0) return { rows, totalVotes, winnerRefs: [], decidedBy: null };

  const maxVotes = rows[0].votes;
  let pool = rows.filter((r) => r.votes === maxVotes);
  if (pool.length === 1) return { rows, totalVotes, winnerRefs: [pool[0].filmId], decidedBy: "votes" };

  const narrow = (key: "picAvg" | "overallAvg") => {
    const best = Math.max(...pool.map((r) => r[key] ?? -Infinity));
    if (best === -Infinity) return pool; // ninguém tem nota: não desempata
    return pool.filter((r) => r[key] !== null && best - (r[key] as number) < TIE_EPSILON);
  };

  pool = narrow("picAvg");
  if (pool.length === 1) return { rows, totalVotes, winnerRefs: [pool[0].filmId], decidedBy: "best_picture" };
  pool = narrow("overallAvg");
  if (pool.length === 1) return { rows, totalVotes, winnerRefs: [pool[0].filmId], decidedBy: "jury_overall" };
  return { rows, totalVotes, winnerRefs: pool.map((r) => r.filmId), decidedBy: "shared" };
}

/** Progresso: notas dadas × esperadas por jurado e filme. */
export function computeProgress(data: JuryData) {
  const films = data.ceremonies.flatMap((c) => c.films.map((f) => ({ ...f, ceremonyName: c.name })));
  const expected = new Map(films.map((f) => [f.id, scoreItemsFor(data.categories, f.cast_members)]));

  const rows = data.jurors.map((j) => {
    const mine = data.scores.filter((s) => s.juror_id === j.id);
    const perFilm = films.map((f) => {
      const items = expected.get(f.id) ?? [];
      const keys = new Set(items.map((i) => `${i.categoryId}:${i.castMemberId ?? "-"}`));
      const given = mine.filter((s) => s.film_id === f.id && keys.has(`${s.category_id}:${s.cast_member_id ?? "-"}`)).length;
      return { filmId: f.id, given, expected: items.length };
    });
    const given = perFilm.reduce((a, p) => a + p.given, 0);
    const total = perFilm.reduce((a, p) => a + p.expected, 0);
    return { juror: j, perFilm, given, total };
  });

  return { films, rows };
}
