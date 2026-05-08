import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/AppShell";
import { getSupabaseServer } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Baumeisterwerk CRM",
  description: "Beziehungsmanagement für Baumeisterwerk",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Wird von der Middleware bereits validiert; hier nur, um die Email
  // im Header anzeigen zu koennen. Auf Login-/Auth-Routen ist user=null.
  let email: string | null = null;
  try {
    const sb = await getSupabaseServer();
    const {
      data: { user },
    } = await sb.auth.getUser();
    email = user?.email ?? null;
  } catch {
    email = null;
  }

  return (
    <html lang="de">
      <body className="min-h-screen font-sans">
        {email ? <AppShell email={email}>{children}</AppShell> : children}
      </body>
    </html>
  );
}
