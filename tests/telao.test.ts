// Testes da lógica do telão (indicados, roteiro, o que o projetor recebe).
// Rodar: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSteps, cueFor, pickNominees, seededShuffle, viewFor, type Award, type Show } from "../lib/telao";

const r = (ref: string) => ({ ref });

test("indicados: top 3, ordem aleatória mas fixa", () => {
  const ranked = ["a", "b", "c", "d", "e"].map(r);
  const n1 = pickNominees(ranked, ["a"], "cer:scr").map((x) => x.ref);
  const n2 = pickNominees(ranked, ["a"], "cer:scr").map((x) => x.ref);
  assert.deepEqual(n1, n2);
  assert.deepEqual([...n1].sort(), ["a", "b", "c"]);
});

test("indicados: vencedor do desempate fora do top 3 entra no lugar do 3º", () => {
  const ranked = ["a", "b", "c", "d"].map(r);
  const n = pickNominees(ranked, ["d"], "x").map((x) => x.ref).sort();
  assert.deepEqual(n, ["a", "b", "d"]);
});

test("indicados: com 3 ou menos concorrentes, todos", () => {
  assert.equal(pickNominees(["a", "b"].map(r), ["a"], "x").length, 2);
});

test("sorteio muda com a semente", () => {
  const list = Array.from({ length: 8 }, (_, i) => i);
  assert.notDeepEqual(seededShuffle(list, "um"), seededShuffle(list, "outro"));
});

const nominee = (ref: string, label: string) => ({ ref, label, sublabel: "", film: { id: ref, title: label, className: null, posterUrl: null } });
const award = (code: string, isPublic = false): Award => ({
  code,
  en: code.toUpperCase(),
  pt: code,
  isPublic,
  nominees: [nominee("f1", "Filme 1"), nominee("f2", "Filme 2")],
  winners: [nominee("f2", "Filme 2")],
  secret: ["Filme 2 · média 9,00"],
  warning: null,
});

const show: Show = {
  ceremony: { id: "c1", name: "Senior", shortName: "SR", votingStatus: "open" },
  editionName: "Film Festival 2026",
  juryClosed: true,
  nextCeremony: null,
  films: [
    { id: "f1", title: "Filme 1", className: "8A", posterUrl: null, driveFileId: "d1", sizeBytes: 1, durationMs: 1 },
    { id: "f2", title: "Filme 2", className: "9A", posterUrl: null, driveFileId: "d2", sizeBytes: 1, durationMs: 1 },
  ],
  awards: [award("scr"), award("pic")],
  pcInfo: { en: "People's Choice", pt: "Escolha do Público" },
  pc: null,
  tracks: [],
};

test("roteiro: abertura, cartela+filme por filme, votação, prêmios, PC e encerramento", () => {
  const steps = buildSteps(show);
  assert.deepEqual(
    steps.map((s) => s.kind + ("filmId" in s ? `:${s.filmId}` : "code" in s ? `:${s.code}` : "")),
    [
      "abertura",
      "cartela:f1", "filme:f1", "cartela:f2", "filme:f2",
      "chamada", "encerrada",
      "cat:scr", "indicados:scr", "vencedor:scr",
      "cat:pic", "indicados:pic", "vencedor:pic",
      "cat:pc", "indicados:pc", "vencedor:pc",
      "fim",
    ],
  );
});

test("projetor: indicados não revelam o vencedor nem a nota", () => {
  const v = viewFor(show, { kind: "indicados", code: "scr" }, null);
  assert.equal(v.kind, "indicados");
  const json = JSON.stringify(v);
  assert.ok(!json.includes("winners"));
  assert.ok(!json.includes("média"));
  assert.ok(!json.includes("secret"));
});

test("projetor: vencedor manda só os vencedores, sem nota", () => {
  const v = viewFor(show, { kind: "vencedor", code: "scr" }, null);
  assert.equal(v.kind, "vencedor");
  if (v.kind === "vencedor") assert.deepEqual(v.winners.map((w) => w.ref), ["f2"]);
  assert.ok(!JSON.stringify(v).includes("média"));
});

test("People's Choice sem resultado fica na apresentação da categoria", () => {
  assert.equal(viewFor(show, { kind: "vencedor", code: "pc" }, null).kind, "cat");
  assert.equal(viewFor(show, { kind: "vencedor", code: "pc" }, award("pc", true)).kind, "vencedor");
});

test("trilha: silêncio nos filmes, fanfarra maior no People's Choice", () => {
  assert.equal(cueFor({ kind: "filme", filmId: "f1" }), null);
  assert.equal(cueFor({ kind: "cartela", filmId: "f1" }), null);
  assert.equal(cueFor({ kind: "vencedor", code: "scr" }), "fanfarra");
  assert.equal(cueFor({ kind: "vencedor", code: "pc" }), "fanfarra_pc");
  assert.equal(cueFor({ kind: "chamada" }), "bastidores");
});
