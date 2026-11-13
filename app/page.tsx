import Link from "next/link";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-xs uppercase tracking-[0.4em] text-gold">Colégio Progresso apresenta</p>
      <h1 className="mt-4 font-display text-5xl sm:text-6xl">Film Festival 2026</h1>
      <p className="mt-2 font-display text-2xl italic text-gold">Classics Edition</p>
      <p className="mt-6 text-muted">24 de novembro · Biblioteca</p>
      <Link
        href="/entrar"
        className="mt-10 rounded-md border border-gold/40 px-6 py-3 text-sm hover:bg-gold/10"
      >
        Acesso da organização e do júri
      </Link>
    </main>
  );
}
