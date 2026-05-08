import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/gmail/oauth";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const oauthError = req.nextUrl.searchParams.get("error");
  if (oauthError) {
    console.error("Gmail OAuth Fehler:", oauthError);
    return NextResponse.redirect(new URL(`/settings?gmail=error&detail=${oauthError}`, req.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL("/settings?gmail=error", req.url));
  }

  const redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri) {
    console.error("GOOGLE_REDIRECT_URI ist nicht gesetzt.");
    return NextResponse.redirect(new URL("/settings?gmail=error&detail=missing_redirect_uri", req.url));
  }

  try {
    const auth = getOAuthClient();
    // WICHTIG: redirect_uri muss EXAKT identisch zum Wert beim Auth-Request
    // (siehe lib/gmail/oauth.ts buildAuthUrl) und zur Eintragung in der
    // Google Cloud Console sein - sonst -> invalid_grant.
    const { tokens } = await auth.getToken({
      code,
      redirect_uri: redirectUri,
    });

    if (!tokens.refresh_token) {
      // Tritt auf, wenn der Nutzer die App schon einmal autorisiert hat:
      // Google liefert den Refresh-Token nur einmalig aus, ausser wir
      // erzwingen "prompt=consent" (machen wir in buildAuthUrl).
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
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("Gmail callback fehlgeschlagen:", msg);
    return NextResponse.redirect(
      new URL(`/settings?gmail=error&detail=${encodeURIComponent(msg)}`, req.url),
    );
  }
}
