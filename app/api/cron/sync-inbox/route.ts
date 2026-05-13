import { NextRequest, NextResponse } from "next/server";
import { runInboxSync } from "@/lib/inbox/process";

// Cron-Endpoint fuer Vercel. Konfiguration in vercel.json.
// Authentifizierung analog /api/cron/daily-digest:
//   Authorization: Bearer <CRON_SECRET>, oder
//   ?token=<CRON_SECRET> (fuer manuelle Tests), oder
//   Vercel-User-Agent falls kein CRON_SECRET gesetzt ist.

export async function GET(req: NextRequest) {
  const headerSecret = req.headers.get("authorization");
  const querySecret = req.nextUrl.searchParams.get("token");
  const expected = process.env.CRON_SECRET;

  const isVercelCron = expected && headerSecret === `Bearer ${expected}`;
  const isManualWithToken = expected && querySecret === expected;
  const isVercelByUA =
    !expected && (req.headers.get("user-agent") ?? "").includes("vercel-cron");

  if (!isVercelCron && !isManualWithToken && !isVercelByUA) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runInboxSync();
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}
