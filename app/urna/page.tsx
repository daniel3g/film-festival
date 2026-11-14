import type { Metadata } from "next";
import { getUrnaState } from "./actions";
import { UrnaApp } from "./urna-app";

export const metadata: Metadata = { title: "Urna" };
// Depende do cookie da urna: renderiza a cada acesso.
export const instant = false;

export default async function UrnaPage() {
  const initial = await getUrnaState();
  return <UrnaApp initial={initial} />;
}
