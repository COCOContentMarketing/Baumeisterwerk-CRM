import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Routen, die OHNE Login zugaenglich sein muessen.
const PUBLIC_PATH_PREFIXES = [
  "/login",
  "/auth/", // /auth/callback, /auth/reset, ...
  "/api/cron/", // Cron-Endpunkte authentifizieren via CRON_SECRET-Header
  "/api/gmail/callback", // OAuth-Redirect von Google
];

function isPublic(pathname: string): boolean {
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix)) return true;
  }
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Cookies refreshen + User holen, bevor wir entscheiden.
  const { response, user } = await updateSession(req);

  if (isPublic(pathname)) {
    // Schon eingeloggter User auf /login -> direkt aufs Dashboard.
    if (user && pathname === "/login") {
      const next = req.nextUrl.searchParams.get("next");
      const target = next && next.startsWith("/") ? next : "/";
      return NextResponse.redirect(new URL(target, req.url));
    }
    return response;
  }

  if (!user) {
    // Original-URL als ?next= mitgeben, damit nach erfolgreichem Login
    // dorthin redirected wird.
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname + (search || ""));
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // Statische Assets, _next, favicon und sonstige Dateien mit Endung
  // bleiben aussen vor.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
