import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { runInboxSync } from "@/lib/inbox/process";

// Manueller Sync-Trigger fuer eingeloggte Nutzer (Dashboard- + Inbox-Button).
export async function POST() {
  try {
    const result = await runInboxSync();
    revalidatePath("/");
    revalidatePath("/inbox");
    revalidatePath("/recommendations");
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unbekannter Fehler" },
      { status: 500 },
    );
  }
}
