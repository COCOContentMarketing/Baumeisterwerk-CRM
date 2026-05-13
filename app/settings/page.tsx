import { redirect } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { DbErrorBanner } from "@/components/DbErrorBanner";
import { getCurrentUser } from "@/lib/db/queries";
import { safeRun } from "@/lib/db/safe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { disconnectGmail } from "@/lib/gmail/drafts";
import { hasInboxScope } from "@/lib/gmail/oauth";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string; detail?: string }>;
}) {
  const userRes = await safeRun("getCurrentUser", getCurrentUser);
  const user = userRes.ok ? userRes.data : null;
  const params = await searchParams;
  const gmailFlash = params.gmail;
  const gmailDetail = params.detail;

  async function saveProfile(formData: FormData) {
    "use server";
    const sb = getSupabaseAdmin();
    const display_name = (formData.get("display_name") as string) || null;
    const signature = (formData.get("signature") as string) || null;
    const email = (formData.get("email") as string) || "";
    if (user) {
      await sb.from("app_user").update({ display_name, signature }).eq("id", user.id);
    } else if (email) {
      await sb.from("app_user").insert({ email, display_name, signature });
    }
    redirect("/settings");
  }

  async function disconnect() {
    "use server";
    await disconnectGmail();
    redirect("/settings");
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title="Einstellungen" />

      {!userRes.ok && <DbErrorBanner area="Profil" message={userRes.error} />}

      {gmailFlash === "connected" && (
        <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
          ✅ Gmail wurde verbunden.
        </div>
      )}
      {gmailFlash === "no_refresh_token" && (
        <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm">
          Kein Refresh-Token erhalten. Bitte über{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            className="underline"
          >
            Google-Berechtigungen
          </a>{" "}
          die App entfernen und erneut verbinden.
        </div>
      )}
      {gmailFlash === "error" && (
        <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
          Fehler bei der Gmail-Verbindung.
          {gmailDetail && (
            <>
              {" "}
              <span className="font-mono text-xs">{decodeURIComponent(gmailDetail)}</span>
            </>
          )}
          <div className="mt-1 text-xs text-brand-700">
            Pruefe, dass <code>GOOGLE_REDIRECT_URI</code> in den Vercel-Env-Vars exakt der bei
            Google Cloud Console eingetragenen Redirect-URI entspricht (inkl. https vs http und
            ohne Trailing-Slash).
          </div>
        </div>
      )}

      <section className="card mb-6 p-6">
        <h2 className="mb-3 text-lg font-semibold text-brand-900">Profil</h2>
        <form action={saveProfile} className="space-y-4">
          <div>
            <label className="label">Email (Login-Identität)</label>
            <input
              name="email"
              type="email"
              defaultValue={user?.email ?? ""}
              required
              disabled={!!user}
              className="input disabled:bg-brand-50"
            />
          </div>
          <div>
            <label className="label">Anzeigename</label>
            <input name="display_name" defaultValue={user?.display_name ?? ""} className="input" />
          </div>
          <div>
            <label className="label">Standard-Signatur (für Email-Drafts)</label>
            <textarea
              name="signature"
              defaultValue={user?.signature ?? ""}
              className="input min-h-[120px] font-mono text-sm"
              placeholder={"Mit besten Grüßen\nName\nhttps://baumeisterwerk.de"}
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary">Speichern</button>
          </div>
        </form>
      </section>

      <section className="card p-6">
        <h2 className="mb-3 text-lg font-semibold text-brand-900">Gmail-Verbindung</h2>
        <p className="mb-4 text-sm text-brand-700">
          Damit Email-Entwürfe direkt in deinem Gmail-Postfach erscheinen, verbinde dein Konto.
          Wir speichern nur den Refresh-Token; das CRM legt ausschließlich Drafts an und sendet
          nichts ohne deine manuelle Bestätigung in Gmail.
        </p>
        {user?.gmail_account_email ? (
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
              Verbunden mit <span className="font-medium">{user.gmail_account_email}</span>
            </div>
            {!hasInboxScope(user.gmail_scopes) && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <div className="font-medium">Posteingang-Zugriff fehlt</div>
                <div className="mt-1 text-xs">
                  Die aktuelle Verbindung erlaubt nur Drafts/Senden, aber kein
                  Lesen des Posteingangs. Fuer Inbox-Sync und Reply-Empfehlungen
                  bitte erneut verbinden - Google fragt diesmal nach dem
                  zusaetzlichen Lesezugriff.
                </div>
                <a href="/api/gmail/connect" className="btn-secondary mt-2 inline-block">
                  Posteingang-Zugriff aktivieren
                </a>
              </div>
            )}
            <form action={disconnect}>
              <button className="btn-ghost text-rose-700 hover:bg-rose-50">Verbindung trennen</button>
            </form>
          </div>
        ) : (
          <a href="/api/gmail/connect" className="btn-primary">
            🔗 Mit Gmail verbinden
          </a>
        )}
      </section>
    </div>
  );
}
