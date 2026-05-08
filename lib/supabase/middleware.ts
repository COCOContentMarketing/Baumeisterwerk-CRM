import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";

// Per-Request Supabase-Client fuer die Middleware. Wichtig: wir muessen
// das NextResponse-Objekt zurueckgeben, das die ggf. aktualisierten
// Auth-Cookies enthaelt, damit Tokens automatisch refresht werden.
export async function updateSession(req: NextRequest) {
  let response = NextResponse.next({
    request: { headers: req.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
          for (const { name, value } of toSet) {
            req.cookies.set(name, value);
          }
          response = NextResponse.next({ request: { headers: req.headers } });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // WICHTIG: getUser() statt getSession(), damit das JWT serverseitig
  // gegen Supabase geprueft wird (signiert + nicht abgelaufen).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
