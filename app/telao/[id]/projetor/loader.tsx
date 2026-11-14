"use client";

import dynamic from "next/dynamic";

// Só no navegador: usa BroadcastChannel, OPFS e tela cheia.
const Projector = dynamic(() => import("./projector"), { ssr: false });

export function ProjectorLoader({ ceremonyId }: { ceremonyId: string }) {
  return <Projector ceremonyId={ceremonyId} />;
}
