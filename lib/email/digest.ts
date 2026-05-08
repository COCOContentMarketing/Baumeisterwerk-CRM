import type { PendingAction } from "@/lib/recommendations/cadence";

const KIND_LABELS: Record<string, string> = {
  email: "Email",
  call: "Telefonat",
  meeting: "Termin",
  follow_up: "Follow-up",
  research: "Recherche",
};

const PRIORITY_LABELS: Record<string, string> = {
  hoch: "🔴 Hoch",
  mittel: "🟡 Mittel",
  niedrig: "⚪ Niedrig",
};

export interface DigestContent {
  subject: string;
  text: string;
  html: string;
}

export function buildDigest(args: {
  appUrl: string;
  actions: PendingAction[];
  todayIso: string;
}): DigestContent {
  const { appUrl, actions, todayIso } = args;
  const niceDate = new Date(todayIso).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const subject =
    actions.length === 0
      ? `Baumeisterwerk – ${niceDate}: nichts faellig`
      : `Baumeisterwerk – ${niceDate}: ${actions.length} Aktion${actions.length === 1 ? "" : "en"} fuer heute`;

  // Plain Text
  const textLines: string[] = [
    `Guten Morgen!`,
    "",
    `Heute (${niceDate}) sind ${actions.length} Aktionen offen.`,
    "",
  ];
  if (actions.length === 0) {
    textLines.push("Nichts faellig - geniess den Kaffee.");
  } else {
    const grouped = groupByPriority(actions);
    for (const [prio, items] of grouped) {
      textLines.push(`### ${PRIORITY_LABELS[prio] ?? prio} (${items.length})`);
      for (const a of items) {
        textLines.push(`- [${KIND_LABELS[a.kind] ?? a.kind}] ${a.company.name} – ${a.title}`);
        if (a.reason) textLines.push(`    ${a.reason}`);
      }
      textLines.push("");
    }
  }
  textLines.push("");
  textLines.push(`Im CRM oeffnen: ${appUrl}/recommendations`);

  // HTML
  const htmlBody = actions.length === 0
    ? `<p>Heute (${escapeHtml(niceDate)}) ist nichts faellig. Geniess den Kaffee. ☕</p>`
    : renderActionsHtml(actions, appUrl);

  const html = `<!doctype html>
<html lang="de"><body style="font-family:-apple-system,Segoe UI,sans-serif;color:#1d1b16;background:#faf9f6;padding:20px;max-width:680px;margin:auto;">
  <h1 style="font-size:18px;color:#2a2519;margin:0 0 4px 0;">Baumeisterwerk – Tagesplan</h1>
  <p style="color:#5c513a;margin:0 0 16px 0;font-size:14px;">${escapeHtml(niceDate)}</p>
  ${htmlBody}
  <p style="margin-top:24px;font-size:13px;color:#5c513a;">
    <a href="${appUrl}/recommendations" style="color:#5c513a;">Im CRM oeffnen →</a>
  </p>
</body></html>`;

  return { subject, text: textLines.join("\n"), html };
}

function renderActionsHtml(actions: PendingAction[], appUrl: string): string {
  const grouped = groupByPriority(actions);
  return Array.from(grouped.entries())
    .map(([prio, items]) => {
      const rows = items
        .map(
          (a) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #e8e5dc;vertical-align:top;width:80px;font-size:12px;color:#5c513a;">${escapeHtml(KIND_LABELS[a.kind] ?? a.kind)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #e8e5dc;">
            <div style="font-weight:600;color:#2a2519;">${escapeHtml(a.title)}</div>
            <div style="font-size:13px;color:#5c513a;">${escapeHtml(a.company.name)}${a.contact.full_name ? " · " + escapeHtml(a.contact.full_name) : ""}</div>
            ${a.reason ? `<div style="font-size:12px;color:#8a7d5e;margin-top:4px;">${escapeHtml(a.reason)}</div>` : ""}
          </td>
        </tr>`,
        )
        .join("");
      return `
        <h2 style="font-size:14px;color:#2a2519;margin:18px 0 6px 0;">${PRIORITY_LABELS[prio] ?? prio} (${items.length})</h2>
        <table style="width:100%;border-collapse:collapse;background:white;border:1px solid #e8e5dc;border-radius:6px;overflow:hidden;">
          ${rows}
        </table>`;
    })
    .join("");
}

function groupByPriority(actions: PendingAction[]): Map<string, PendingAction[]> {
  const out = new Map<string, PendingAction[]>();
  for (const p of ["hoch", "mittel", "niedrig"]) out.set(p, []);
  for (const a of actions) {
    out.get(a.priority)!.push(a);
  }
  for (const k of Array.from(out.keys())) {
    if (out.get(k)!.length === 0) out.delete(k);
  }
  return out;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
