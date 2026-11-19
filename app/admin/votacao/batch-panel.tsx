"use client";

import { useState, useTransition } from "react";
import { generateAllCards, generateBatch, type GeneratedBatch } from "./actions";

type BatchInfo = { batch: "A" | "B" | "C" | "D"; total: number; used: number };

/** Lotes de códigos de uma cerimônia: gerar, gerar de novo e imprimir os cartões. */
export function BatchPanel({
  ceremonyId,
  ceremonyName,
  shortName,
  batches,
  suggested,
}: {
  ceremonyId: string;
  ceremonyName: string;
  shortName: string;
  batches: BatchInfo[];
  suggested: number; // lotes recomendados para esta cerimônia
}) {
  const [printing, setPrinting] = useState<Extract<GeneratedBatch, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function generate(b: BatchInfo) {
    const again = b.total > 0;
    if (
      again &&
      !window.confirm(
        `Gerar o lote ${b.batch} de novo? Os ${b.total} cartões já impressos desse lote deixam de valer. Use só se os cartões não foram distribuídos.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await generateBatch(ceremonyId, b.batch);
      if (r.ok) setPrinting(r);
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-3">
      <ul className="space-y-2 text-sm">
        {batches.map((b, i) => {
          const optional = i >= suggested;
          return (
            <li key={b.batch} className="flex items-center justify-between gap-3">
              <span>
                Lote {b.batch}
                {optional && b.total === 0 && <span className="text-muted"> (extra, opcional)</span>}
                {b.total > 0 && (
                  <span className="text-muted">
                    {" "}
                    · {b.used}/{b.total} usados
                  </span>
                )}
              </span>
              {b.used > 0 ? (
                <span className="text-xs text-muted">em uso</span>
              ) : (
                <button
                  type="button"
                  className={b.total ? "btn-ghost px-3 py-1 text-xs" : "btn px-3 py-1 text-xs"}
                  disabled={pending}
                  onClick={() => generate(b)}
                >
                  {b.total ? "Gerar de novo" : "Gerar e imprimir"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-red-300">{error}</p>}

      {printing && (
        <CardsSheet
          title={`${ceremonyName} · Lote ${printing.batch}`}
          groups={[{ ceremonyName, shortName, batch: printing.batch, codes: printing.codes }]}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  );
}

type CardGroup = { ceremonyName: string; shortName: string; batch: string; codes: string[] };

/** Gera os lotes que faltam das três cerimônias e abre tudo numa folha só (um PDF). */
export function AllCardsButton({ pending }: { pending: number }) {
  const [groups, setGroups] = useState<CardGroup[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function run() {
    if (
      !window.confirm(
        `Gerar ${pending} lotes de cartões de uma vez? Os códigos aparecem só agora: salve o PDF antes de fechar a folha.`,
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await generateAllCards();
      if (r.ok) setGroups(r.groups);
      else setError(r.error);
    });
  }

  return (
    <div className="space-y-2">
      <button type="button" className="btn" disabled={busy} onClick={run}>
        {busy ? "Gerando…" : "Gerar todos e salvar PDF"}
      </button>
      {error && <p className="text-sm text-red-300">{error}</p>}
      {groups && (
        <CardsSheet
          title={`Todas as cerimônias · ${groups.length} lotes`}
          groups={groups}
          onClose={() => setGroups(null)}
        />
      )}
    </div>
  );
}

/**
 * Folha de cartões (15 por A4; cada lote de 30 ocupa 2 folhas inteiras).
 * Os códigos só existem aqui: imprima ou salve o PDF antes de fechar.
 */
function CardsSheet({ title, groups, onClose }: { title: string; groups: CardGroup[]; onClose: () => void }) {
  const total = groups.reduce((n, g) => n + g.codes.length, 0);
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4 print:static print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm] space-y-4 print:max-w-none">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 print:hidden">
          <div>
            <p className="font-medium">
              {title} · {total} cartões
            </p>
            {groups.length > 1 && (
              <p className="mt-1 text-sm text-muted">
                {groups.map((g) => `${g.shortName} ${g.batch}`).join(" · ")}
              </p>
            )}
            <p className="mt-1 text-sm text-amber-300">
              Por segurança, estes códigos não ficam guardados e não aparecem de novo. Clique em Imprimir e, em
              &quot;Destino&quot;, escolha <strong>Salvar como PDF</strong>.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => window.print()}>
              Imprimir / PDF
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                window.confirm("Já salvou o PDF ou imprimiu? Depois de fechar, os códigos não aparecem de novo.") && onClose()
              }
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="print-area grid grid-cols-3 bg-white text-black">
          {groups.flatMap((g) =>
            g.codes.map((code, i) => (
              <div
                key={code}
                className="flex h-[54mm] flex-col items-center justify-between border border-dashed border-neutral-400 p-[4mm] text-center"
              >
                <div>
                  <p className="text-[8pt] uppercase tracking-[0.25em] text-neutral-600">Film Festival 2026</p>
                  <p className="font-display text-[13pt] leading-tight">People&apos;s Choice</p>
                  <p className="text-[8pt] text-neutral-600">{g.shortName}</p>
                </div>
                <p className="font-mono text-[20pt] font-bold tracking-[0.12em]">{code}</p>
                <div>
                  <p className="text-[7.5pt] leading-snug text-neutral-700">
                    Digite este código na urna e escolha seu filme favorito. Vale um voto.
                  </p>
                  <p className="mt-1 text-[6.5pt] text-neutral-500">
                    {g.shortName} · Lote {g.batch} · {String(i + 1).padStart(2, "0")}
                  </p>
                </div>
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
