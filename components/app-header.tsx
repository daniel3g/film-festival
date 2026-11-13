import Link from "next/link";

export function AppHeader({
  area,
  email,
  nav = [],
}: {
  area: string;
  email: string | null;
  nav?: { href: string; label: string }[];
}) {
  return (
    <header className="border-b border-gold/20 bg-panel">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" className="font-display text-lg text-gold">
          Film Festival <span className="text-foreground">· {area}</span>
        </Link>
        <nav className="flex flex-wrap gap-4 text-sm text-muted">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {email && <span className="hidden text-muted sm:inline">{email}</span>}
          <form action="/auth/sair" method="post">
            <button className="rounded-md border border-gold/30 px-3 py-1 hover:bg-gold/10">Sair</button>
          </form>
        </div>
      </div>
    </header>
  );
}
