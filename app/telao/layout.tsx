import type { Metadata } from "next";
import { requireRole } from "@/lib/auth";
import { SwRegister } from "@/components/telao/sw-register";
import "./telao.css";

// Área logada: depende da sessão a cada acesso.
export const instant = false;

export const metadata: Metadata = { title: "Telão" };

/** Telão: tela cheia, sem cabeçalho. Só admin. */
export default async function TelaoLayout({ children }: LayoutProps<"/telao">) {
  await requireRole("admin");
  return (
    <>
      <SwRegister />
      {children}
    </>
  );
}
