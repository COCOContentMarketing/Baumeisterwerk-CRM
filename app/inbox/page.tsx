import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { DbErrorBanner } from "@/components/DbErrorBanner";
import { getCurrentUser, listInboxItems } from "@/lib/db/queries";
import { safeRun } from "@/lib/db/safe";
import { hasInboxScope } from "@/lib/gmail/oauth";
import { CheckInboxButton } from "@/app/_components/CheckInboxButton";
import { InboxRow } from "./_components/InboxRow";

export const dynamic = "force-dynamic";

export default async function InboxPage() {
  const [itemsRes, user] = await Promise.all([
    safeRun("listInboxItems", listInboxItems),
    getCurrentUser(),
  ]);
  const items = itemsRes.ok ? itemsRes.data : [];
  const gmailConnected = !!user?.gmail_refresh_token;
  const readyForInbox = gmailConnected && hasInboxScope(user?.gmail_scopes);

  return (
    <div>
      <PageHeader
        title="Posteingang"
        subtitle={
          readyForInbox
            ? "Wird automatisch alle 15 Minuten synchronisiert."
            : gmailConnected
              ? "Gmail-Verbindung ist vorhanden, aber ohne Posteingang-Zugriff."
              : "Gmail ist noch nicht verbunden."
        }
        actions={<CheckInboxButton />}
      />

      {!itemsRes.ok && <DbErrorBanner area="Posteingang" message={itemsRes.error} />}

      {!readyForInbox && (
        <div className="card mb-4 p-4 text-sm text-brand-700">
          Damit eingehende Mails hier auftauchen, bitte Gmail mit Posteingang-
          Zugriff unter{" "}
          <Link href="/settings" className="underline">
            Einstellungen
          </Link>{" "}
          verbinden.
        </div>
      )}

      {readyForInbox && items.length === 0 && itemsRes.ok && (
        <div className="card p-6 text-center text-sm text-brand-500">
          Keine eingegangenen Mails der letzten Zeit. Sobald neue Mails von
          bekannten Kontakten eingehen, erscheinen sie hier.
        </div>
      )}

      <div className="space-y-3">
        {items.map((it) => (
          <InboxRow key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}
