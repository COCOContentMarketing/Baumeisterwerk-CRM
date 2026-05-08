import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

// Auth-aware Server-Client: nutzt die Anon-Key + die Cookie-Session
// des eingeloggten Users. Wird in Server Components, Route Handlern
// und Server Actions verwendet, sobald wir auf die Identitaet zugreifen
// muessen (auth.getUser()).
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: { name: string; value: string; options: CookieOptions }[]) => {
          for (const { name, value, options } of toSet) {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // Setzen kann in einigen Server-Component-Kontexten nicht
              // moeglich sein - ignorieren ist hier die offizielle
              // Empfehlung (siehe Supabase SSR Docs).
            }
          }
        },
      },
    },
  );
}

// Re-export aus admin.ts fuer Backwards-Compat.
export { getSupabaseAdmin } from "./admin";
