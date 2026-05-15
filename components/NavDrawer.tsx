"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

type NavItem = { href: string; label: string };

export function NavDrawer({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-ghost lg:hidden"
        aria-label="Menü öffnen"
        aria-expanded={open}
      >
        <span className="text-lg leading-none">☰</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            aria-label="Menü schließen"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-full w-64 max-w-[80%] flex-col border-r border-brand-100 bg-white px-4 py-6">
            <div className="mb-8 flex items-center justify-between gap-2">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-3"
              >
                <Image
                  src="/logo-dragon.png"
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
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-ghost"
                aria-label="Menü schließen"
              >
                ✕
              </button>
            </div>
            <nav className="space-y-1">
              {items.map((it) => (
                <Link
                  key={it.href}
                  href={it.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-sm text-brand-900 hover:bg-brand-100"
                >
                  {it.label}
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
