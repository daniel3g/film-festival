import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadShow } from "@/lib/telao-server";
import { PanelLoader } from "./loader";

export const metadata: Metadata = { title: "Telão · painel" };

export default async function TelaoPainelPage({ params }: PageProps<"/telao/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const show = await loadShow(supabase, id);
  if (!show) notFound();

  return <PanelLoader show={show} />;
}
