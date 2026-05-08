import { createClient } from "@supabase/supabase-js";

// Service-Role Client. Wird ausschliesslich serverseitig verwendet (Server
// Components, Route Handlers, Server Actions). Liegt bewusst in einem eigenen
// Modul ohne `next/headers`-Import, damit Importe leichtgewichtig bleiben.
export function getSupabaseAdmin() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase ist nicht konfiguriert. Bitte NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in den Vercel-Env-Vars setzen.",
    );
  }
  // Trailing-Slash entfernen, weil supabase-js sonst eine Doppel-Slash-URL
  // zusammenbaut (https://xxx.supabase.co//rest/v1/...), was als
  // PGRST125 'Invalid path' zurueckkommt.
  url = url.replace(/\/+$/, "");
  if (!/^https?:\/\//.test(url)) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL muss mit https:// beginnen, war aber: ${url.slice(0, 30)}...`,
    );
  }
  if (url.includes("/rest/v1") || url.includes("?")) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL darf keinen Pfad oder Query enthalten. Erwartet z.B. https://xxx.supabase.co, war aber: ${url}`,
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
