export function DbErrorBanner({ area, message }: { area: string; message: string }) {
  return (
    <div className="mb-4 rounded-md border border-rose-200 bg-rose-50 p-3 text-sm">
      <div className="font-medium text-rose-900">{area} konnten nicht geladen werden.</div>
      <div className="mt-1 font-mono text-xs text-rose-700 break-all">{message}</div>
      <div className="mt-2 text-xs text-rose-700">
        Häufige Ursachen:
        <ul className="ml-4 list-disc">
          <li>
            Migration <code>supabase/migrations/0001_init.sql</code> wurde nicht ausgeführt.
          </li>
          <li>
            <code>NEXT_PUBLIC_SUPABASE_URL</code> enthält einen Pfad/Slash am Ende oder zeigt
            auf ein anderes Projekt als <code>SUPABASE_SERVICE_ROLE_KEY</code>.
          </li>
          <li>
            PGRST125 deutet meist auf ein URL-Format-Problem hin – prüfe in den Vercel-Env-Vars,
            dass die Supabase-URL die Form <code>https://xxx.supabase.co</code> hat (ohne Pfad,
            ohne Trailing-Slash).
          </li>
        </ul>
      </div>
    </div>
  );
}
