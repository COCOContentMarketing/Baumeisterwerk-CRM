import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Baumeisterwerk CRM",
  description: "Beziehungsmanagement für Baumeisterwerk",
};

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/companies", label: "Unternehmen" },
  { href: "/contacts", label: "Kontakte" },
  { href: "/recommendations", label: "Empfehlungen" },
  { href: "/settings", label: "Einstellungen" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen font-sans">
        <div className="flex min-h-screen">
          <aside className="w-60 shrink-0 border-r border-brand-100 bg-white px-4 py-6">
            <Link href="/" className="mb-8 block">
              <div className="text-lg font-semibold text-brand-900">Baumeisterwerk</div>
              <div className="text-xs text-brand-500">CRM</div>
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
          <main className="flex-1 px-8 py-6">{children}</main>
        </div>
      </body>
    </html>
  );
}
