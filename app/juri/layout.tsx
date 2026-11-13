import { requireRole } from "@/lib/auth";
import { AppHeader } from "@/components/app-header";

// Área logada: depende da sessão a cada acesso.
export const instant = false;

export default async function JuriLayout({ children }: LayoutProps<"/juri">) {
  const { email } = await requireRole("juror");
  return (
    <>
      <AppHeader area="Júri" email={email} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </>
  );
}
