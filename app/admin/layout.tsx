import { requireRole } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

// Área logada: depende da sessão a cada acesso.
export const instant = false;

const NAV = [
  { href: "/admin", label: "Início" },
  { href: "/admin/filmes", label: "Filmes" },
  { href: "/admin/jurados", label: "Jurados" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { email } = await requireRole("admin");
  return (
    <>
      <AppHeader area="Admin" email={email} nav={NAV} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
