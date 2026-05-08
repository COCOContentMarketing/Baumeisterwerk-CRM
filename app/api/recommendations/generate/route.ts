import { NextResponse } from "next/server";
import { computePendingActions, persistRecommendations } from "@/lib/recommendations/engine";

// Wertet die B2B-Kontaktzyklen jetzt aus und persistiert offene Empfehlungen.
// Wird auch vom Daily-Digest-Cron aufgerufen, ist aber per UI-Button manuell
// triggerbar.
export async function POST() {
  try {
    const now = new Date();
    const actions = await computePendingActions(now);
    const result = await persistRecommendations(actions);
    return NextResponse.json({ pending: actions.length, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
