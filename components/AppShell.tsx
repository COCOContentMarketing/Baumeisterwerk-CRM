import Link from "next/link";
import Image from "next/image";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/companies", label: "Unternehmen" },
  { href: "/contacts", label: "Kontakte" },
  { href: "/recommendations", label: "Empfehlungen" },
  { href: "/settings", label: "Einstellungen" },
];

export function AppShell({
  email,
  children,
}: {
  email: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-brand-100 bg-white px-4 py-6">
        <Link href="/" className="mb-8 flex items-center gap-3">
          <Image
            src="/dragon.png"
            alt="Baumeisterwerk"
            width={32}
            height={32}
            className="shrink-0"
          />
          <div>
            <div className="text-lg font-semibold leading-tight text-brand-900">
              Baumeisterwerk
            </div>
            <div className="text-xs text-brand-500">CRM</div>
          </div>
        </Link>
        <nav className="space-y-1">
          {navItems.map((it) => (
            <Link
              key={it.href}
              href={it.href}
              className="block rounded-md px-3 py-2 text-sm text-brand-900 hover:bg-brand-100"
            >
              {it.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-brand-100 bg-white px-8 py-3">
          <div className="text-xs text-brand-500">Eingeloggt als</div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-brand-900">{email}</span>
            <form action="/logout" method="post">
              <button
                type="submit"
                className="text-xs text-brand-700 hover:underline"
                aria-label="Abmelden"
              >
                Abmelden
              </button>
            </form>
          </div>
        </header>
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
