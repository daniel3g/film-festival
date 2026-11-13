import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionInfo, homeFor } from "@/lib/auth";
import { GoogleButton } from "./google-button";

export const metadata: Metadata = { title: "Entrar" };
// Depende da sessão (cookies): renderiza a cada acesso.
export const instant = false;

const ERRORS: Record<string, string> = {
  "sem-acesso":
    "Esta conta não tem acesso. Jurados entram com o e-mail @colegioprogresso.g12.br cadastrado pela organização. Fale com a organização.",
  "falha-login": "O login não foi concluído. Tente de novo.",
};

export default async function EntrarPage({ searchParams }: PageProps<"/entrar">) {
  const params = await searchParams;
  const erro = typeof params.erro === "string" ? params.erro : undefined;
  const voltar = typeof params.voltar === "string" ? params.voltar : undefined;

  // Já logado com acesso: vai direto para a sua área.
  const info = await getSessionInfo();
  if (info.role !== "none" && !erro) redirect(homeFor(info.role));

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm rounded-xl border border-gold/30 bg-panel p-8 shadow-2xl">
        <p className="text-xs uppercase tracking-[0.3em] text-gold">Film Festival 2026</p>
        <h1 className="mt-2 font-display text-3xl">Classics Edition</h1>
        <p className="mt-4 text-sm text-muted">
          Acesso da organização e do júri. A votação do público é feita nas urnas, sem login.
        </p>

        {erro && ERRORS[erro] && (
          <p role="alert" className="mt-6 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            {ERRORS[erro]}
          </p>
        )}

        <div className="mt-8">
          <GoogleButton next={voltar} />
        </div>
      </div>
    </main>
  );
}
