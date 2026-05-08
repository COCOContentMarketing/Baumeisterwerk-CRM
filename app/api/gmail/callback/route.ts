import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient, getRedirectUri } from "@/lib/gmail/oauth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) {
    console.error("[gmail/callback] OAuth-Fehler von Google:", oauthError);
    return NextResponse.redirect(
      new URL(`/settings?gmail=error&detail=${encodeURIComponent(oauthError)}`, req.url),
    );
  }
  if (!code) {
    return NextResponse.redirect(new URL("/settings?gmail=error&detail=no_code", req.url));
  }

  let redirectUri: string;
  try {
    redirectUri = getRedirectUri();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "missing_redirect_uri";
    console.error("[gmail/callback] redirect_uri:", msg);
    return NextResponse.redirect(
      new URL(`/settings?gmail=error&detail=${encodeURIComponent(msg)}`, req.url),
    );
  }

  // Diagnose-Log: ein falsch konfiguriertes redirect_uri ist die Hauptursache
  // fuer invalid_grant. Wir loggen den Wert (kein Secret), damit der
  // Konfigurationsfehler in den Vercel-Logs sofort sichtbar ist.
  console.log("[gmail/callback] Token-Tausch mit redirect_uri =", redirectUri);

  try {
    const auth = getOAuthClient();
    // WICHTIG: redirect_uri muss byte-genau identisch sein zu:
    //   1) dem Wert aus buildAuthUrl (lib/gmail/oauth.ts)
    //   2) der in der Google Cloud Console eingetragenen Redirect-URI
    // Sonst antwortet Google mit invalid_grant.
    const { tokens } = await auth.getToken({ code, redirect_uri: redirectUri });

    if (!tokens.refresh_token) {
      // Tritt auf, wenn der Nutzer die App schon einmal autorisiert hat:
      // Google liefert den Refresh-Token nur einmalig aus, ausser wir
      // erzwingen prompt=consent (machen wir in buildAuthUrl).
      return NextResponse.redirect(new URL("/settings?gmail=no_refresh_token", req.url));
    }
    auth.setCredentials(tokens);

    const oauth2 = google.oauth2({ version: "v2", auth });
    const me = await oauth2.userinfo.get();
    const email = me.data.email;
    if (!email) {
      return NextResponse.redirect(new URL("/settings?gmail=error&detail=no_email", req.url));
    }

    const sb = getSupabaseAdmin();
    const user = await getCurrentUser();
    if (user) {
      const { error } = await sb
        .from("app_user")
        .update({
          gmail_refresh_token: tokens.refresh_token,
          gmail_account_email: email,
        })
        .eq("id", user.id);
      if (error) throw error;
    } else {
      const { error } = await sb.from("app_user").insert({
        email,
        display_name: me.data.name ?? null,
        gmail_refresh_token: tokens.refresh_token,
        gmail_account_email: email,
      });
      if (error) throw error;
    }
    return NextResponse.redirect(new URL("/settings?gmail=connected", req.url));
  } catch (e) {
    // Google-OAuth-Fehler liefern oft ein response.data-Objekt.
    type GAxiosError = { response?: { data?: { error?: string; error_description?: string } } };
    const axE = e as GAxiosError;
    const detail =
      axE.response?.data?.error_description ||
      axE.response?.data?.error ||
      (e instanceof Error ? e.message : "unknown");
    console.error("[gmail/callback] Token-Tausch fehlgeschlagen. redirect_uri war:", redirectUri);
    console.error("[gmail/callback] Fehler-Detail:", detail);
    if (axE.response?.data) {
      console.error("[gmail/callback] Google-Response:", axE.response.data);
    }
    return NextResponse.redirect(
      new URL(`/settings?gmail=error&detail=${encodeURIComponent(detail)}`, req.url),
    );
  }
}
