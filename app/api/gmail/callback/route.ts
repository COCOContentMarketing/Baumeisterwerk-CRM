import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";
import { getOAuthClient } from "@/lib/gmail/oauth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/db/queries";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.redirect(new URL("/settings?gmail=error", req.url));
  }
  const auth = getOAuthClient();
  const { tokens } = await auth.getToken(code);
  if (!tokens.refresh_token) {
    return NextResponse.redirect(new URL("/settings?gmail=no_refresh_token", req.url));
  }
  auth.setCredentials(tokens);

  const oauth2 = google.oauth2({ version: "v2", auth });
  const me = await oauth2.userinfo.get();

  const sb = getSupabaseAdmin();
  const user = await getCurrentUser();

  if (user) {
    await sb
      .from("app_user")
      .update({
        gmail_refresh_token: tokens.refresh_token,
        gmail_account_email: me.data.email,
      })
      .eq("id", user.id);
  } else {
    await sb.from("app_user").insert({
      email: me.data.email!,
      display_name: me.data.name ?? null,
      gmail_refresh_token: tokens.refresh_token,
      gmail_account_email: me.data.email,
    });
  }
  return NextResponse.redirect(new URL("/settings?gmail=connected", req.url));
}
