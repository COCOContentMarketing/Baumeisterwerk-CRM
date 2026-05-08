// Defensive Wrapper: faengt DB-Fehler ab, damit eine einzelne fehlgeschlagene
// Query nicht die ganze Server-Component crasht (500). Stattdessen liefert sie
// ein leeres Resultat plus eine Fehler-Beschreibung, die in der UI als Banner
// angezeigt werden kann.

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function safeRun<T>(
  label: string,
  fn: () => Promise<T>,
): Promise<Result<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    const msg = formatDbError(e);
    console.error(`[db] ${label} fehlgeschlagen:`, msg);
    return { ok: false, error: msg };
  }
}

function formatDbError(e: unknown): string {
  if (typeof e === "object" && e !== null) {
    const anyE = e as { code?: string; message?: string; details?: string; hint?: string };
    const parts: string[] = [];
    if (anyE.code) parts.push(`[${anyE.code}]`);
    if (anyE.message) parts.push(anyE.message);
    if (anyE.details) parts.push(`(${anyE.details})`);
    if (anyE.hint) parts.push(`hint: ${anyE.hint}`);
    if (parts.length > 0) return parts.join(" ");
  }
  return e instanceof Error ? e.message : "Unbekannter Fehler";
}
