"use client";

import { useState, useTransition } from "react";
import { generateBatch, type GeneratedBatch } from "./actions";

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
          ceremonyName={ceremonyName}
          shortName={shortName}
          batch={printing.batch}
          codes={printing.codes}
          onClose={() => setPrinting(null)}
        />
      )}
    </div>
  );
}

/** Folha de cartões (15 por A4). Os códigos só existem aqui: imprima antes de fechar. */
function CardsSheet({
  ceremonyName,
  shortName,
  batch,
  codes,
  onClose,
}: {
  ceremonyName: string;
  shortName: string;
  batch: string;
  codes: string[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 overflow-auto bg-black/80 p-4 print:static print:bg-white print:p-0">
      <div className="mx-auto max-w-[210mm] space-y-4 print:max-w-none">
        <div className="card flex flex-wrap items-center justify-between gap-3 p-4 print:hidden">
          <div>
            <p className="font-medium">
              {ceremonyName} · Lote {batch} · {codes.length} cartões
            </p>
            <p className="text-sm text-amber-300">
              Imprima agora: por segurança, estes códigos não ficam guardados e não aparecem de novo.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn" onClick={() => window.print()}>
              Imprimir
            </button>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => window.confirm("Já imprimiu os cartões? Depois de fechar, os códigos não aparecem de novo.") && onClose()}
            >
              Fechar
            </button>
          </div>
        </div>

        <div className="print-area grid grid-cols-3 bg-white text-black">
          {codes.map((code, i) => (
            <div
              key={code}
              className="flex h-[54mm] flex-col items-center justify-between border border-dashed border-neutral-400 p-[4mm] text-center"
            >
              <div>
                <p className="text-[8pt] uppercase tracking-[0.25em] text-neutral-600">Film Festival 2026</p>
                <p className="font-display text-[13pt] leading-tight">People&apos;s Choice</p>
                <p className="text-[8pt] text-neutral-600">{shortName}</p>
              </div>
              <p className="font-mono text-[20pt] font-bold tracking-[0.12em]">{code}</p>
              <div>
                <p className="text-[7.5pt] leading-snug text-neutral-700">
                  Digite este código na urna e escolha seu filme favorito. Vale um voto.
                </p>
                <p className="mt-1 text-[6.5pt] text-neutral-500">
                  Lote {batch} · {String(i + 1).padStart(2, "0")}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
