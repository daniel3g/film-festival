"use client";

import { useRef, useState, useTransition } from "react";
import { saveScore } from "../../actions";

export type PanelItem = {
  key: string;
  categoryId: string;
  castMemberId: string | null;
  label: string;
  sublabel: string;
  group: "film" | "acting";
};

type Status = "idle" | "saving" | "saved" | "error";

const OPTIONS = Array.from({ length: 21 }, (_, i) => i / 2); // 0, 0.5 … 10
const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 ? 1 : 0 });

export function ScorePanel({
  filmId,
  items,
  initial,
  readOnly,
}: {
  filmId: string;
  items: PanelItem[];
  initial: Record<string, number>;
  readOnly: boolean;
}) {
  const [values, setValues] = useState<Record<string, number | null>>(initial);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, startTransition] = useTransition();
  // Número da última alteração de cada nota: respostas antigas são ignoradas.
  const seq = useRef<Record<string, number>>({});

  const done = items.filter((i) => values[i.key] != null).length;

  function change(item: PanelItem, raw: string) {
    const value = raw === "" ? null : Number(raw);
    const previous = values[item.key] ?? null;
    const mySeq = (seq.current[item.key] ?? 0) + 1;
    seq.current[item.key] = mySeq;
    setValues((v) => ({ ...v, [item.key]: value }));
    setStatus((s) => ({ ...s, [item.key]: "saving" }));

    startTransition(async () => {
      let result;
      try {
        result = await saveScore({ filmId, categoryId: item.categoryId, castMemberId: item.castMemberId, value });
      } catch {
        result = { ok: false as const, error: "Sem conexão. Tente de novo." };
      }
      if (seq.current[item.key] !== mySeq) return; // já houve outra alteração depois desta
      if (result.ok) {
        setStatus((s) => ({ ...s, [item.key]: "saved" }));
        setErrors((e) => {
          const rest = { ...e };
          delete rest[item.key];
          return rest;
        });
      } else {
        // Volta ao valor anterior para a tela não mostrar algo que não foi salvo.
        setValues((v) => ({ ...v, [item.key]: previous }));
        setStatus((s) => ({ ...s, [item.key]: "error" }));
        setErrors((e) => ({ ...e, [item.key]: result.error }));
      }
    });
  }

  const groups: { id: PanelItem["group"]; title: string }[] = [
    { id: "film", title: "Filme" },
    { id: "acting", title: "Atuação" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {done} de {items.length} notas
        </p>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-background">
          <div className="h-full bg-gold transition-all" style={{ width: `${items.length ? (done / items.length) * 100 : 0}%` }} />
        </div>
      </div>

      {readOnly && (
        <p className="rounded-md border border-gold/30 bg-gold/10 p-3 text-sm">
          A avaliação foi encerrada pela organização. As notas estão só para consulta.
        </p>
      )}

      {groups.map((g) => {
        const list = items.filter((i) => i.group === g.id);
        if (!list.length) return null;
        return (
          <section key={g.id}>
            <h3 className="mb-2 text-xs uppercase tracking-[0.2em] text-gold">{g.title}</h3>
            <ul className="divide-y divide-gold/10">
              {list.map((item) => {
                const v = values[item.key];
                const st = status[item.key] ?? "idle";
                return (
                  <li key={item.key} className="py-3">
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{item.label}</p>
                        <p className="truncate text-xs text-muted">{item.sublabel}</p>
                      </div>
                      <span className="w-14 text-right text-xs" aria-live="polite">
                        {st === "saving" && <span className="text-muted">salvando…</span>}
                        {st === "saved" && <span className="text-emerald-300">✓ salvo</span>}
                        {st === "error" && <span className="text-red-300">erro</span>}
                      </span>
                      <select
                        aria-label={`Nota: ${item.label}`}
                        className="input w-24 text-center text-base"
                        value={v == null ? "" : String(v)}
                        disabled={readOnly}
                        onChange={(e) => change(item, e.target.value)}
                      >
                        <option value="">—</option>
                        {OPTIONS.map((o) => (
                          <option key={o} value={String(o)}>
                            {fmt(o)}
                          </option>
                        ))}
                      </select>
                    </div>
                    {errors[item.key] && <p className="mt-1 text-xs text-red-300">{errors[item.key]}</p>}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      {items.length === 0 && (
        <p className="text-sm text-muted">Nada para avaliar neste filme ainda.</p>
      )}
    </div>
  );
}
