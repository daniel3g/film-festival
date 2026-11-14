"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Live = {
  stats: Record<string, { status: string; votes: number; codes: number }>;
  seen: Record<string, string | null>;
  at: string;
} | null;

const LiveContext = createContext<{ data: Live; stale: boolean }>({ data: null, stale: false });

/** Consulta o contador a cada 3 s e compartilha com os componentes da página. */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Live>(null);
  const [stale, setStale] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/admin/votacao", { cache: "no-store" });
        if (!res.ok) throw new Error();
        const json = await res.json();
        if (alive) {
          setData(json);
          setStale(false);
        }
      } catch {
        if (alive) setStale(true);
      }
    };
    tick();
    const id = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return <LiveContext.Provider value={{ data, stale }}>{children}</LiveContext.Provider>;
}

export function LiveVotes({ ceremonyId, initialVotes, initialCodes }: { ceremonyId: string; initialVotes: number; initialCodes: number }) {
  const { data, stale } = useContext(LiveContext);
  const s = data?.stats[ceremonyId];
  const votes = s?.votes ?? initialVotes;
  const codes = s?.codes ?? initialCodes;
  return (
    <div>
      <p className="font-display text-4xl text-gold tabular-nums">{votes}</p>
      <p className="text-xs text-muted">
        voto{votes === 1 ? "" : "s"} · {codes} cartões gerados
        {stale && <span className="ml-1 text-amber-300">(desatualizado)</span>}
      </p>
    </div>
  );
}

export function LastSeen({ deviceId, initial }: { deviceId: string; initial: string | null }) {
  const { data } = useContext(LiveContext);
  const iso = data?.seen[deviceId] ?? initial;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  if (!iso) return <span className="text-muted">nunca usada</span>;
  const secs = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  return (
    <span className={secs < 120 ? "text-emerald-300" : "text-muted"}>
      {secs < 60 ? `ativa há ${secs}s` : secs < 3600 ? `ativa há ${Math.round(secs / 60)} min` : "inativa"}
    </span>
  );
}
