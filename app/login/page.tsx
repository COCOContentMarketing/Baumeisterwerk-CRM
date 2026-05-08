import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function safeNext(input: string | string[] | undefined): string {
  if (typeof input !== "string") return "/";
  // Nur relative Pfade zulassen, sonst sind Open-Redirects moeglich.
  if (!input.startsWith("/") || input.startsWith("//")) return "/";
  return input;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const errorMsg = params.error;

  async function signIn(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const nextRaw = String(formData.get("next") ?? "/");
    const targetNext = safeNext(nextRaw);

    if (!email || !password) {
      redirect(`/login?error=${encodeURIComponent("Email und Passwort erforderlich")}&next=${encodeURIComponent(targetNext)}`);
    }

    const sb = await getSupabaseServer();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      redirect(`/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(targetNext)}`);
    }
    redirect(targetNext);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <Image
            src="/dragon.png"
            alt="Baumeisterwerk"
            width={80}
            height={80}
            priority
            className="mb-4"
          />
          <div className="text-xl font-semibold text-brand-900">Baumeisterwerk</div>
          <div className="text-xs text-brand-500">CRM</div>
        </div>
        <form action={signIn} className="card space-y-4 p-6">
          <input type="hidden" name="next" value={next} />
          <h1 className="text-lg font-semibold text-brand-900">Anmelden</h1>
          <div>
            <label className="label">Email</label>
            <input
              name="email"
              type="email"
              required
              autoFocus
              autoComplete="email"
              className="input"
            />
          </div>
          <div>
            <label className="label">Passwort</label>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="input"
            />
          </div>
          {errorMsg && (
            <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
              {errorMsg}
            </div>
          )}
          <button type="submit" className="btn-primary w-full justify-center">
            Anmelden
          </button>
          <div className="text-center text-xs text-brand-500">
            <Link href="/auth/reset" className="hover:underline">
              Passwort vergessen?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
