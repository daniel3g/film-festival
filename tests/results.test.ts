// Testes da lógica de resultados do júri (médias, empates, desempate).
// Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeJuryResults, computeProgress, type JuryData } from "../lib/results";

const cat = (id: string, code: string, kind: "film" | "acting", acting: "actress" | "actor" | null, order: number) => ({
  id,
  code,
  name_pt: code,
  name_en: code,
  kind,
  acting_category: acting,
  award_order: order,
});

function base(): JuryData {
  return {
    edition: { id: "ed", name: "Teste", jury_status: "closed" },
    categories: [cat("scr", "scr", "film", null, 1), cat("actress", "actress", "acting", "actress", 4)],
    ceremonies: [
      {
        id: "c1",
        name: "Cer 1",
        sort_order: 1,
        films: [
          { id: "fA", title: "A", class_name: null, screening_order: 1, cast_members: [
            { id: "ana", student_name: "Ana", role_name: null, is_evaluated: true, acting_category: "actress" },
            { id: "caio", student_name: "Caio", role_name: null, is_evaluated: false, acting_category: null },
          ] },
          { id: "fB", title: "B", class_name: null, screening_order: 2, cast_members: [
            { id: "bia", student_name: "Bia", role_name: null, is_evaluated: true, acting_category: "actress" },
          ] },
        ],
      },
      { id: "c2", name: "Cer 2", sort_order: 2, films: [{ id: "fC", title: "C", class_name: null, screening_order: 1, cast_members: [] }] },
    ],
    jurors: [
      { id: "j1", name: null, email: "1", user_id: "u1" },
      { id: "j2", name: null, email: "2", user_id: "u2" },
      { id: "j3", name: null, email: "3", user_id: null },
    ],
    scores: [],
    tiebreaks: [],
  };
}

const s = (juror_id: string, category_id: string, film_id: string, value: number, cast_member_id: string | null = null) => ({
  juror_id, category_id, film_id, cast_member_id, value,
});

const find = (d: JuryData, cer: string, catId: string) =>
  computeJuryResults(d).find((r) => r.ceremonyId === cer && r.category.id === catId)!;

test("média ignora jurado sem nota e define vencedor", () => {
  const d = base();
  d.scores = [s("j1", "scr", "fA", 8), s("j2", "scr", "fA", 9), s("j1", "scr", "fB", 7)];
  const r = find(d, "c1", "scr");
  assert.equal(r.rows[0].ref, "fA");
  assert.equal(r.rows[0].avg, 8.5);
  assert.equal(r.rows[1].avg, 7); // só j1 deu nota a B: não puxa a média para baixo
  assert.deepEqual(r.winnerRefs, ["fA"]);
  assert.equal(r.tiedRefs, null);
});

test("filmes concorrem só dentro da própria cerimônia", () => {
  const d = base();
  d.scores = [s("j1", "scr", "fC", 10), s("j1", "scr", "fA", 5)];
  assert.deepEqual(find(d, "c1", "scr").winnerRefs, ["fA"]);
  assert.deepEqual(find(d, "c2", "scr").winnerRefs, ["fC"]);
});

test("empate no 1º lugar sem desempate fica sem vencedor", () => {
  const d = base();
  d.scores = [s("j1", "scr", "fA", 8), s("j1", "scr", "fB", 8)];
  const r = find(d, "c1", "scr");
  assert.deepEqual(new Set(r.tiedRefs), new Set(["fA", "fB"]));
  assert.equal(r.unresolvedTie, true);
  assert.deepEqual(r.winnerRefs, []);
  assert.equal(r.rows[0].position, 1);
  assert.equal(r.rows[1].position, 1);
});

test("médias quase iguais (< 0,005) contam como empate; 0,01 de diferença não", () => {
  const d = base();
  // A = (8 + 8.5 + 8.5)/3 = 8.333…; B = 8.333… também
  d.scores = [s("j1", "scr", "fA", 8), s("j2", "scr", "fA", 8.5), s("j3", "scr", "fA", 8.5),
              s("j1", "scr", "fB", 8.5), s("j2", "scr", "fB", 8.5), s("j3", "scr", "fB", 8)];
  assert.ok(find(d, "c1", "scr").tiedRefs);

  const d2 = base();
  d2.scores = [s("j1", "scr", "fA", 8), s("j1", "scr", "fB", 7.5)];
  assert.equal(find(d2, "c1", "scr").tiedRefs, null);
});

test("desempate decidido define o vencedor; maioria é calculada", () => {
  const d = base();
  d.scores = [s("j1", "scr", "fA", 8), s("j1", "scr", "fB", 8)];
  d.tiebreaks = [{
    id: "t1", ceremony_id: "c1", category_id: "scr", tied_refs: ["fA", "fB"], status: "decided",
    winner_ref: "fB", method: "majority",
    tiebreak_votes: [{ juror_id: "j1", choice_ref: "fB" }, { juror_id: "j2", choice_ref: "fB" }, { juror_id: "j3", choice_ref: "fA" }],
  }];
  const r = find(d, "c1", "scr");
  assert.deepEqual(r.winnerRefs, ["fB"]);
  assert.equal(r.unresolvedTie, false);
  assert.equal(r.tiebreak?.majorityRef, "fB");
  assert.deepEqual(r.tiebreak?.counts, { fA: 1, fB: 2 });
});

test("desempate sem maioria não sugere vencedor; votos inválidos são ignorados", () => {
  const d = base();
  d.scores = [s("j1", "scr", "fA", 8), s("j1", "scr", "fB", 8)];
  d.tiebreaks = [{
    id: "t1", ceremony_id: "c1", category_id: "scr", tied_refs: ["fA", "fB"], status: "open",
    winner_ref: null, method: null,
    tiebreak_votes: [
      { juror_id: "j1", choice_ref: "fA" },
      { juror_id: "j2", choice_ref: "fB" },
      { juror_id: "j3", choice_ref: "fC" },       // fora do empate
      { juror_id: "removido", choice_ref: "fA" }, // jurado que não existe mais
    ],
  }];
  const tb = find(d, "c1", "scr").tiebreak!;
  assert.equal(tb.majorityRef, null);
  assert.equal(tb.voters, 2);
});

test("atuação: só integrantes avaliados da categoria certa concorrem", () => {
  const d = base();
  d.scores = [s("j1", "actress", "fA", 9, "ana"), s("j1", "actress", "fB", 7, "bia")];
  const r = find(d, "c1", "actress");
  assert.deepEqual(r.rows.map((x) => x.ref).sort(), ["ana", "bia"]);
  assert.deepEqual(r.winnerRefs, ["ana"]);
});

test("categoria sem nenhuma nota não tem vencedor", () => {
  const r = find(base(), "c1", "scr");
  assert.deepEqual(r.winnerRefs, []);
  assert.equal(r.tiedRefs, null);
  assert.equal(r.unresolvedTie, false);
});

test("progresso conta notas esperadas (filme + avaliados)", () => {
  const d = base();
  d.scores = [s("j1", "scr", "fA", 8), s("j1", "actress", "fA", 9, "ana")];
  const p = computeProgress(d);
  const j1 = p.rows.find((r) => r.juror.id === "j1")!;
  // fA: scr + Ana = 2; fB: scr + Bia = 2; fC: scr = 1 → 5
  assert.equal(j1.total, 5);
  assert.equal(j1.given, 2);
  assert.deepEqual(j1.perFilm.find((f) => f.filmId === "fA"), { filmId: "fA", given: 2, expected: 2 });
});
