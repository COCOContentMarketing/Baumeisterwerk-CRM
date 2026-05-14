import Link from "next/link";
import Image from "next/image";
import { NavDrawer } from "./NavDrawer";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/inbox", label: "Posteingang" },
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
      <aside className="hidden w-60 shrink-0 border-r border-brand-100 bg-white px-4 py-6 lg:block">
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-brand-100 bg-white px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <NavDrawer items={navItems} />
            <div className="hidden text-xs text-brand-500 sm:block">
              Eingeloggt als
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="truncate text-sm text-brand-900">{email}</span>
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
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
