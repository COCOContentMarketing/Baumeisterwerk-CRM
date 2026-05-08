import { createClient } from "@supabase/supabase-js";

// Service-Role Client. Wird ausschliesslich serverseitig verwendet (Server
// Components, Route Handlers, Server Actions). Liegt bewusst in einem eigenen
// Modul ohne `next/headers`-Import, damit Importe leichtgewichtig bleiben.
export function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase ist nicht konfiguriert. Bitte NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY setzen.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
