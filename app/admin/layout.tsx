import { requireRole } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

// Área logada: depende da sessão a cada acesso.
export const instant = false;

// Os itens de cadastro entram aqui conforme as telas forem criadas.
const NAV = [{ href: "/admin", label: "Início" }];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const { email } = await requireRole("admin");
  return (
    <>
      <AppHeader area="Admin" email={email} nav={NAV} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
