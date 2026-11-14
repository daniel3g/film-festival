import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { computeJuryResults, computePeoplesChoice, loadJuryData } from "@/lib/results";
import { BATCHES, BATCH_SIZE } from "@/lib/vote-codes";
import { setVotingStatus } from "./actions";
import { BatchPanel } from "./batch-panel";
import { DevicesPanel } from "./devices-panel";
import { LiveProvider, LiveVotes } from "./live";
import { ResetVoting } from "./reset-voting";

export const metadata: Metadata = { title: "Votação" };

/** Votantes esperados por cerimônia (docs/01) → lotes recomendados. */
const EXPECTED_VOTERS: Record<string, number> = { JM: 60, SR: 59, JT: 95 };

const STATUS_LABEL = { not_started: "não aberta", open: "ABERTA", closed: "encerrada" } as const;
const DECIDED_BY = {
  votes: "mais votado",
  best_picture: "desempate: média do júri em Melhor Filme",
  jury_overall: "desempate: média geral do júri",
  shared: "empate total: prêmio dividido",
} as const;

export default async function VotacaoPage() {
  const supabase = await createClient();
  const [juryData, { data: codes }, { data: devices }, { data: votes }] = await Promise.all([
    loadJuryData(supabase),
    supabase.from("vote_codes").select("ceremony_id, batch, used_at"),
    supabase
      .from("devices")
      .select("id, label, ceremony_id, token_hash, revoked_at, pairing_expires_at, last_seen_at")
      .order("created_at"),
    // RLS: votos por filme só aparecem depois de encerrada a votação.
    supabase.from("votes").select("ceremony_id, film_id"),
  ]);

  const { data: ceremonies } = await supabase
    .from("ceremonies")
    .select("id, name, short_name, code_prefix, voting_status, voting_opened_at, voting_closed_at, sort_order, editions!inner(is_active)")
    .eq("editions.is_active", true)
    .order("sort_order");

  const jury = computeJuryResults(juryData);
  const now = new Date().toISOString();

  return (
    <LiveProvider>
      <div className="space-y-10">
        <div>
          <h1 className="font-display text-3xl">Votação do público</h1>
          <p className="mt-1 text-muted">
            People&apos;s Choice: cartões com código, urnas pareadas e resultado oculto até encerrar.
          </p>
        </div>

        {/* ---------------- Cerimônias */}
        <section className="grid gap-4 lg:grid-cols-3">
          {ceremonies?.map((c) => {
            const mine = (codes ?? []).filter((k) => k.ceremony_id === c.id);
            const batches = BATCHES.map((b) => {
              const list = mine.filter((k) => k.batch === b);
              return { batch: b, total: list.length, used: list.filter((k) => k.used_at).length };
            });
            const suggested = Math.min(
              BATCHES.length,
              Math.ceil(((EXPECTED_VOTERS[c.code_prefix] ?? 60) * 1.2) / BATCH_SIZE),
            );
            const status = c.voting_status;
            const cer = juryData.ceremonies.find((x) => x.id === c.id);
            const votesByFilm: Record<string, number> = {};
            for (const v of votes ?? []) if (v.ceremony_id === c.id) votesByFilm[v.film_id] = (votesByFilm[v.film_id] ?? 0) + 1;
            const pc = status === "closed" && cer ? computePeoplesChoice(cer, votesByFilm, jury) : null;

            return (
              <article key={c.id} className="card space-y-5 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-gold">{c.code_prefix}</p>
                    <h2 className="font-display text-xl">{c.name}</h2>
                    <p
                      className={`mt-1 text-sm font-medium ${
                        status === "open" ? "text-emerald-300" : status === "closed" ? "text-gold" : "text-muted"
                      }`}
                    >
                      Votação {STATUS_LABEL[status]}
                    </p>
                  </div>
                  <LiveVotes ceremonyId={c.id} initialVotes={mine.filter((k) => k.used_at).length} initialCodes={mine.length} />
                </div>

                <form action={setVotingStatus}>
                  <input type="hidden" name="ceremony_id" value={c.id} />
                  <input type="hidden" name="status" value={status === "open" ? "closed" : "open"} />
                  {status === "open" ? (
                    <ConfirmSubmit className="btn w-full" message={`Encerrar a votação de "${c.name}"? As urnas param de aceitar votos.`}>
                      Encerrar votação
                    </ConfirmSubmit>
                  ) : status === "closed" ? (
                    <ConfirmSubmit className="btn-ghost w-full" message="Reabrir a votação? Use só para corrigir engano operacional (fica no log).">
                      Reabrir votação
                    </ConfirmSubmit>
                  ) : (
                    <ConfirmSubmit
                      className="btn w-full"
                      message={
                        mine.length === 0
                          ? "Ainda não há cartões gerados para esta cerimônia. Abrir mesmo assim?"
                          : `Abrir a votação de "${c.name}"?`
                      }
                    >
                      Abrir votação
                    </ConfirmSubmit>
                  )}
                </form>

                <div>
                  <h3 className="mb-2 text-xs uppercase tracking-[0.2em] text-gold">Cartões</h3>
                  <p className="mb-2 text-xs text-muted">
                    ~{EXPECTED_VOTERS[c.code_prefix] ?? "?"} votantes → {suggested} lote(s) de {BATCH_SIZE}.
                  </p>
                  <BatchPanel
                    ceremonyId={c.id}
                    ceremonyName={c.name}
                    shortName={c.short_name}
                    batches={batches}
                    suggested={suggested}
                  />
                </div>

                {pc && (
                  <details className="rounded-md border border-gold/20 p-3">
                    <summary className="cursor-pointer select-none text-sm text-gold">
                      Resultado (só você vê) · {pc.totalVotes} votos
                    </summary>
                    <ol className="mt-3 space-y-1 text-sm">
                      {pc.rows.map((r) => (
                        <li key={r.filmId} className="flex justify-between gap-2">
                          <span className={pc.winnerRefs.includes(r.filmId) ? "text-gold" : ""}>
                            {pc.winnerRefs.includes(r.filmId) && "🏆 "}
                            {r.label}
                          </span>
                          <span className="tabular-nums">{r.votes}</span>
                        </li>
                      ))}
                    </ol>
                    {pc.decidedBy && <p className="mt-2 text-xs text-muted">{DECIDED_BY[pc.decidedBy]}</p>}
                  </details>
                )}

                <ResetVoting ceremonyId={c.id} ceremonyName={c.name} prefix={c.code_prefix} />
              </article>
            );
          })}
        </section>

        {/* ---------------- Urnas */}
        <section className="card space-y-4 p-6">
          <div>
            <h2 className="font-display text-xl">Urnas</h2>
            <p className="mt-1 text-sm text-muted">
              Crie uma urna por computador, gere o código de pareamento e digite-o em <strong>/urna</strong> no
              computador. A cerimônia de cada urna pode ser trocada a qualquer momento (ex.: entre as sessões).
            </p>
          </div>
          <DevicesPanel
            ceremonies={(ceremonies ?? []).map((c) => ({ id: c.id, name: c.name }))}
            devices={(devices ?? []).map((d) => ({
              id: d.id,
              label: d.label,
              ceremony_id: d.ceremony_id,
              paired: !!d.token_hash,
              revoked: !!d.revoked_at,
              pairingPending: !!d.pairing_expires_at && d.pairing_expires_at > now,
              last_seen_at: d.last_seen_at,
            }))}
          />
        </section>
      </div>
    </LiveProvider>
  );
}
