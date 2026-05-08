import { NextRequest, NextResponse } from "next/server";
import { computePendingActions, persistRecommendations } from "@/lib/recommendations/engine";
import { buildDigest } from "@/lib/email/digest";
import { sendGmail } from "@/lib/gmail/send";
import { getCurrentUser } from "@/lib/db/queries";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

// Vercel-Cron triggert diese Route taeglich (siehe vercel.json).
// Wir lassen aber auch manuelle Aufrufe per ?token=CRON_SECRET zu, damit
// das Setup einfach getestet werden kann.

export async function GET(req: NextRequest) {
  const headerSecret = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("token");
  const expected = process.env.CRON_SECRET;

  // Vercel-Cron schickt automatisch "Authorization: Bearer <CRON_SECRET>".
  const isVercelCron = expected && headerSecret === `Bearer ${expected}`;
  const isManualWithToken = expected && querySecret === expected;
  // Wenn kein CRON_SECRET gesetzt ist, erlauben wir nur Vercel's User-Agent.
  const isVercelByUA =
    !expected && (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (!isVercelCron && !isManualWithToken && !isVercelByUA) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "no_user_configured" }, { status: 500 });
    }
    if (!user.digest_enabled) {
      return NextResponse.json({ skipped: "digest_disabled" });
    }
    const recipient = user.digest_email ?? user.email;
    if (!recipient) {
      return NextResponse.json({ error: "no_digest_recipient" }, { status: 500 });
    }

    const now = new Date();
    const actions = await computePendingActions(now);
    const result = await persistRecommendations(actions);

    const digest = buildDigest({
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://example.invalid",
      actions,
      todayIso: now.toISOString(),
    });

    if (!user.gmail_refresh_token) {
      // Kein Versand moeglich, aber Recommendations wurden geschrieben.
      console.warn("[cron/daily-digest] Gmail nicht verbunden, kein Versand. Aktionen:", actions.length);
      return NextResponse.json({
        actions: actions.length,
        ...result,
        sent: false,
        reason: "gmail_not_connected",
      });
    }

    await sendGmail({
      to: recipient,
      subject: digest.subject,
      bodyText: digest.text,
      bodyHtml: digest.html,
    });

    const sb = getSupabaseAdmin();
    await sb.from("app_user").update({ digest_last_sent_at: now.toISOString() }).eq("id", user.id);

    return NextResponse.json({
      actions: actions.length,
      ...result,
      sent: true,
      to: recipient,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    console.error("[cron/daily-digest] Fehler:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
