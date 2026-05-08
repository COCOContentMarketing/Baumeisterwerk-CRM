import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; error?: string }>;
}) {
  const params = await searchParams;

  async function requestReset(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    if (!email) {
      redirect(`/auth/reset?error=${encodeURIComponent("Email erforderlich")}`);
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const sb = await getSupabaseServer();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${appUrl}/auth/callback?next=/auth/reset?status=set_new`,
    });
    if (error) {
      redirect(`/auth/reset?error=${encodeURIComponent(error.message)}`);
    }
    redirect("/auth/reset?status=sent");
  }

  async function setNewPassword(formData: FormData) {
    "use server";
    const password = String(formData.get("password") ?? "");
    if (password.length < 8) {
      redirect(`/auth/reset?status=set_new&error=${encodeURIComponent("Mindestens 8 Zeichen")}`);
    }
    const sb = await getSupabaseServer();
    const { error } = await sb.auth.updateUser({ password });
    if (error) {
      redirect(`/auth/reset?status=set_new&error=${encodeURIComponent(error.message)}`);
    }
    redirect("/");
  }

  const showSetNew = params.status === "set_new";

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-xl font-semibold text-brand-900">Baumeisterwerk</div>
          <div className="text-xs text-brand-500">CRM</div>
        </div>

        {params.status === "sent" && (
          <div className="card mb-4 p-4 text-sm">
            ✅ Falls die Email-Adresse hinterlegt ist, wurde ein Reset-Link gesendet. Prüfe dein
            Postfach.
          </div>
        )}

        {showSetNew ? (
          <form action={setNewPassword} className="card space-y-4 p-6">
            <h1 className="text-lg font-semibold text-brand-900">Neues Passwort setzen</h1>
            <div>
              <label className="label">Neues Passwort</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                autoFocus
                className="input"
              />
            </div>
            {params.error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                {params.error}
              </div>
            )}
            <button type="submit" className="btn-primary w-full justify-center">
              Passwort speichern
            </button>
          </form>
        ) : (
          <form action={requestReset} className="card space-y-4 p-6">
            <h1 className="text-lg font-semibold text-brand-900">Passwort zurücksetzen</h1>
            <p className="text-xs text-brand-500">
              Wir senden dir einen Link, mit dem du ein neues Passwort vergeben kannst.
            </p>
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" required autoFocus className="input" />
            </div>
            {params.error && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                {params.error}
              </div>
            )}
            <button type="submit" className="btn-primary w-full justify-center">
              Reset-Link senden
            </button>
            <div className="text-center text-xs text-brand-500">
              <Link href="/login" className="hover:underline">
                Zurück zum Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
