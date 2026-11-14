"use client";

import dynamic from "next/dynamic";
import type { Show } from "@/lib/telao";

// Só no navegador: usa sessionStorage, BroadcastChannel, OPFS e Web Audio.
const Panel = dynamic(() => import("./panel"), { ssr: false });

export function PanelLoader({ show }: { show: Show }) {
  return <Panel show={show} />;
}
