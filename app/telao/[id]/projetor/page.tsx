import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectorLoader } from "./loader";

export const metadata: Metadata = { title: "Projetor" };

export default async function ProjetorPage({ params }: PageProps<"/telao/[id]/projetor">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  return <ProjectorLoader ceremonyId={id} />;
}
