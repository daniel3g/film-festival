import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { computeJuryResults, computeProgress, loadJuryData, type CategoryResult } from "@/lib/results";
import { openTiebreak, resetTiebreak, setJuryStatus } from "./actions";
import { DecideForm } from "./decide-form";

export const metadata: Metadata = { title: "Júri · painel" };

const fmtAvg = (v: number | null) =>
  v === null ? "—" : v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default async function AdminJuriPage() {
  const supabase = await createClient();
  const data = await loadJuryData(supabase);
  if (!data.edition) return <p className="text-muted">Nenhuma edição ativa.</p>;

  const closed = data.edition.jury_status === "closed";
  const progress = computeProgress(data);
  const results = computeJuryResults(data);
  const totalGiven = progress.rows.reduce((a, r) => a + r.given, 0);
  const totalExpected = progress.rows.reduce((a, r) => a + r.total, 0);
  const ties = results.filter((r) => r.tiedRefs);
  const pendingTies = results.filter((r) => r.unresolvedTie);

  return (
    <div className="space-y-10">
      {/* ---------------- Situação */}
      <section className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">Júri</h1>
          <p className="mt-1 text-muted">
            Avaliação{" "}
            <strong className={closed ? "text-gold" : "text-emerald-300"}>{closed ? "encerrada" : "aberta"}</strong>
            {" · "}
            {totalGiven} de {totalExpected} notas ({data.jurors.length} jurado{data.jurors.length === 1 ? "" : "s"})
          </p>
        </div>
        <form action={setJuryStatus}>
          <input type="hidden" name="status" value={closed ? "open" : "closed"} />
          {closed ? (
            <ConfirmSubmit
              className="btn-ghost"
              message="Reabrir a avaliação? Os jurados voltam a poder alterar notas e os desempates registrados serão apagados."
            >
              Reabrir avaliação
            </ConfirmSubmit>
          ) : (
            <ConfirmSubmit
              className="btn"
              message={
                totalGiven < totalExpected
                  ? `Ainda faltam ${totalExpected - totalGiven} notas. Encerrar mesmo assim? As médias usam só as notas dadas.`
                  : "Encerrar a avaliação? Os jurados não poderão mais alterar as notas."
              }
            >
              Encerrar avaliação
            </ConfirmSubmit>
          )}
        </form>
      </section>

      {/* ---------------- Progresso */}
      <section className="space-y-3">
        <h2 className="font-display text-xl">Progresso</h2>
        {progress.rows.length === 0 || progress.films.length === 0 ? (
          <p className="text-sm text-muted">Cadastre jurados e filmes para acompanhar o progresso.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-gold/15 text-left text-xs text-muted">
                <tr>
                  <th className="sticky left-0 bg-panel px-4 py-3 font-normal">Jurado</th>
                  {progress.films.map((f) => (
                    <th key={f.id} className="min-w-24 px-2 py-3 text-center font-normal" title={`${f.ceremonyName}: ${f.title}`}>
                      <span className="line-clamp-2">{f.title}</span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-normal">Total</th>
                </tr>
              </thead>
              <tbody>
                {progress.rows.map((r) => (
                  <tr key={r.juror.id} className="border-b border-gold/10 last:border-0">
                    <td className="sticky left-0 bg-panel px-4 py-2">
                      <p>{r.juror.name ?? r.juror.email}</p>
                      {!r.juror.user_id && <p className="text-xs text-amber-300">ainda não entrou</p>}
                    </td>
                    {r.perFilm.map((p) => (
                      <td key={p.filmId} className="px-2 py-2 text-center">
                        {p.expected === 0 ? (
                          <span className="text-muted">—</span>
                        ) : p.given >= p.expected ? (
                          <span className="text-emerald-300">✓</span>
                        ) : (
                          <span className={p.given ? "text-amber-300" : "text-muted"}>
                            {p.given}/{p.expected}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right">
                      {r.given}/{r.total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ---------------- Desempates */}
      {closed && ties.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display text-xl">Desempates</h2>
          <p className="text-sm text-muted">
            Empate no 1º lugar: abra a rodada; cada jurado escolhe um dos empatados na área do júri. Vence a maioria
            simples; sem maioria, você decide (voto de minerva).
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            {ties.map((r) => (
              <TieCard key={`${r.ceremonyId}:${r.category.id}`} result={r} ceremonyName={ceremonyName(data, r.ceremonyId)} jurorCount={data.jurors.length} />
            ))}
          </div>
        </section>
      )}

      {/* ---------------- Resultados */}
      <section className="space-y-3">
        <h2 className="font-display text-xl">Resultados</h2>
        <p className="text-sm text-muted">
          Só você vê. Médias entre os jurados que deram nota.{" "}
          {pendingTies.length > 0 && closed && (
            <span className="text-amber-300">{pendingTies.length} empate(s) sem decisão.</span>
          )}
        </p>
        <details className="card p-4">
          <summary className="cursor-pointer select-none text-sm text-gold">
            Mostrar notas e ranking (cuidado se a tela estiver sendo projetada)
          </summary>
          <div className="mt-4 space-y-8">
            {data.ceremonies.map((c) => {
              const list = results.filter((r) => r.ceremonyId === c.id);
              if (!list.length) return null;
              return (
                <div key={c.id}>
                  <h3 className="font-display text-lg text-gold">{c.name}</h3>
                  <div className="mt-3 grid gap-4 lg:grid-cols-2">
                    {list.map((r) => (
                      <ResultTable key={r.category.id} result={r} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </details>
      </section>
    </div>
  );
}

function ceremonyName(data: Awaited<ReturnType<typeof loadJuryData>>, id: string) {
  return data.ceremonies.find((c) => c.id === id)?.name ?? "";
}

function ResultTable({ result }: { result: CategoryResult }) {
  return (
    <div className="rounded-md border border-gold/15">
      <div className="flex items-center justify-between border-b border-gold/15 px-3 py-2">
        <p className="text-sm font-medium">{result.category.name_pt}</p>
        {result.unresolvedTie && <span className="text-xs text-amber-300">empate</span>}
      </div>
      <table className="w-full text-sm">
        <tbody>
          {result.rows.map((row) => {
            const winner = result.winnerRefs.includes(row.ref);
            return (
              <tr key={row.ref} className="border-b border-gold/10 last:border-0">
                <td className="w-8 px-3 py-1.5 text-muted">{row.position ?? "—"}</td>
                <td className="py-1.5">
                  <span className={winner ? "text-gold" : ""}>
                    {winner && "🏆 "}
                    {row.label}
                  </span>
                  {row.sublabel && <span className="block text-xs text-muted">{row.sublabel}</span>}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">{fmtAvg(row.avg)}</td>
                <td className="px-3 py-1.5 text-right text-xs text-muted">{row.votes} nota(s)</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TieCard({ result, ceremonyName, jurorCount }: { result: CategoryResult; ceremonyName: string; jurorCount: number }) {
  const tb = result.tiebreak;
  const label = (ref: string) => result.rows.find((r) => r.ref === ref)?.label ?? "?";

  return (
    <div className="card space-y-3 p-4">
      <div>
        <p className="text-xs text-muted">{ceremonyName}</p>
        <p className="font-medium">{result.category.name_pt}</p>
        <p className="text-sm text-muted">Empatados: {(result.tiedRefs ?? []).map(label).join(", ")}</p>
      </div>

      {!tb && (
        <form action={openTiebreak}>
          <input type="hidden" name="ceremony_id" value={result.ceremonyId} />
          <input type="hidden" name="category_id" value={result.category.id} />
          <button className="btn">Abrir rodada de desempate</button>
        </form>
      )}

      {tb?.status === "open" && (
        <>
          <p className="text-sm">
            Rodada aberta · {tb.voters} de {jurorCount} jurado(s) votaram
          </p>
          <DecideForm
            tiebreakId={tb.id}
            majorityRef={tb.majorityRef}
            options={tb.tiedRefs.map((ref) => ({ ref, label: label(ref), votes: tb.counts[ref] ?? 0 }))}
          />
          <form action={resetTiebreak}>
            <input type="hidden" name="tiebreak_id" value={tb.id} />
            <input type="hidden" name="mode" value="delete" />
            <ConfirmSubmit className="btn-ghost text-xs" message="Cancelar esta rodada? Os votos dos jurados nela serão apagados.">
              Cancelar rodada
            </ConfirmSubmit>
          </form>
        </>
      )}

      {tb?.status === "decided" && tb.winnerRef && (
        <>
          <p className="text-sm">
            🏆 <span className="text-gold">{label(tb.winnerRef)}</span>{" "}
            <span className="text-muted">
              ({tb.method === "majority" ? "maioria" : "voto de minerva"} ·{" "}
              {tb.tiedRefs.map((r) => `${label(r)}: ${tb.counts[r] ?? 0}`).join(", ")})
            </span>
          </p>
          <form action={resetTiebreak}>
            <input type="hidden" name="tiebreak_id" value={tb.id} />
            <input type="hidden" name="mode" value="reopen" />
            <ConfirmSubmit className="btn-ghost text-xs" message="Desfazer a decisão e voltar a rodada para votação?">
              Desfazer decisão
            </ConfirmSubmit>
          </form>
        </>
      )}
    </div>
  );
}
