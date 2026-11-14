// Testes do People's Choice (cascata) e da normalização dos códigos.
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeJuryResults, computePeoplesChoice, type JuryData } from "../lib/results";
import { CODE_ALPHABET, normalizeCode, randomCodeBody } from "../lib/vote-codes";

const cat = (id: string, kind: "film" | "acting", order: number) => ({
  id, code: id, name_pt: id, name_en: id, kind, acting_category: null, award_order: order,
});

function data(scores: [string, string, number][]): JuryData {
  return {
    edition: { id: "ed", name: "T", jury_status: "closed" },
    categories: [cat("scr", "film", 1), cat("cos", "film", 2), cat("cin", "film", 3), cat("pic", "film", 6)],
    ceremonies: [{
      id: "c1", name: "C1", sort_order: 1,
      films: ["fA", "fB", "fC"].map((id, i) => ({ id, title: id, class_name: null, screening_order: i, cast_members: [] })),
    }],
    jurors: [{ id: "j1", name: null, email: "1", user_id: "u" }],
    scores: scores.map(([category_id, film_id, value]) => ({ juror_id: "j1", category_id, film_id, cast_member_id: null, value })),
    tiebreaks: [],
  };
}

const pc = (d: JuryData, votes: Record<string, number>) =>
  computePeoplesChoice(d.ceremonies[0], votes, computeJuryResults(d));

test("mais votado vence", () => {
  const r = pc(data([]), { fA: 10, fB: 25, fC: 3 });
  assert.deepEqual(r.winnerRefs, ["fB"]);
  assert.equal(r.decidedBy, "votes");
  assert.equal(r.totalVotes, 38);
});

test("empate em votos → maior média do júri em Melhor Filme", () => {
  const r = pc(data([["pic", "fA", 7], ["pic", "fB", 9]]), { fA: 20, fB: 20, fC: 1 });
  assert.deepEqual(r.winnerRefs, ["fB"]);
  assert.equal(r.decidedBy, "best_picture");
});

test("empate em votos e Melhor Filme → média geral do júri", () => {
  const r = pc(
    data([["pic", "fA", 8], ["pic", "fB", 8], ["scr", "fA", 10], ["scr", "fB", 6]]),
    { fA: 20, fB: 20 },
  );
  // A: (8+10)/2 = 9 ; B: (8+6)/2 = 7
  assert.deepEqual(r.winnerRefs, ["fA"]);
  assert.equal(r.decidedBy, "jury_overall");
});

test("empate em tudo → prêmio dividido", () => {
  const r = pc(data([["pic", "fA", 8], ["pic", "fB", 8]]), { fA: 20, fB: 20, fC: 5 });
  assert.deepEqual(r.winnerRefs.sort(), ["fA", "fB"]);
  assert.equal(r.decidedBy, "shared");
});

test("sem notas do júri, empate em votos vira prêmio dividido", () => {
  const r = pc(data([]), { fA: 4, fB: 4 });
  assert.deepEqual(r.winnerRefs.sort(), ["fA", "fB"]);
  assert.equal(r.decidedBy, "shared");
});

test("filme não votado não entra no empate de zero votos", () => {
  const r = pc(data([]), { fA: 1 });
  assert.deepEqual(r.winnerRefs, ["fA"]);
});

test("sem votos, sem vencedor", () => {
  const r = pc(data([]), {});
  assert.deepEqual(r.winnerRefs, []);
  assert.equal(r.decidedBy, null);
});

test("normalizeCode aceita variações e usa o prefixo da urna", () => {
  process.env.VOTE_CODE_PEPPER ??= "x".repeat(32);
  assert.equal(normalizeCode("SR-K7PX", "SR"), "SR-K7PX");
  assert.equal(normalizeCode(" sr k7px ", "SR"), "SR-K7PX");
  assert.equal(normalizeCode("srk7px", "SR"), "SR-K7PX");
  assert.equal(normalizeCode("k7px", "SR"), "SR-K7PX");
  assert.equal(normalizeCode("jm-k7px", "SR"), "JM-K7PX"); // cartão de outra cerimônia
  assert.equal(normalizeCode("abc", "SR"), null);
  assert.equal(normalizeCode("", "SR"), null);
  assert.equal(normalizeCode("12-K7PX", "SR"), null);
});

test("códigos gerados usam só o alfabeto sem ambiguidade", () => {
  for (let i = 0; i < 500; i++) {
    const body = randomCodeBody();
    assert.equal(body.length, 4);
    for (const ch of body) assert.ok(CODE_ALPHABET.includes(ch), ch);
  }
});
