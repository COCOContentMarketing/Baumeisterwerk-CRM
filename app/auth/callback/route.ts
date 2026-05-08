import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

// Standard-Supabase-Auth-Callback. Wird genutzt von:
// - Magic Links / Email-OTP / OAuth (PKCE-Flow): ?code=...
// - Recovery / Email-Confirm Links (Hash-Flow): #access_token=... -
//   wird clientseitig im Browser verarbeitet und uebergibt dann via
//   POST hier dieselbe Session an Supabase.
//
// In dieser Single-User-Variante reicht der PKCE-Code-Flow: Supabase
// bekommt den Code, tauscht ihn gegen eine Session und setzt Cookies.

function safeNext(input: string | null): string {
  if (!input || !input.startsWith("/") || input.startsWith("//")) return "/";
  return input;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNext(req.nextUrl.searchParams.get("next"));

  if (code) {
    const sb = await getSupabaseServer();
    const { error } = await sb.auth.exchangeCodeForSession(code);
    if (error) {
      const url = new URL("/login", req.url);
      url.searchParams.set("error", error.message);
      url.searchParams.set("next", next);
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.redirect(new URL(next, req.url));
}
