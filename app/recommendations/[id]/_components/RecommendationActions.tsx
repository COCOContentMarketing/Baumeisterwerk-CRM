"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EmailComposer } from "@/components/EmailComposer";
import type { RecommendationKind, RecommendationStatus } from "@/types/db";

export function RecommendationActions({
  recommendationId,
  kind,
  contactId,
  contactEmail,
  contactName,
}: {
  recommendationId: string;
  kind: RecommendationKind;
  contactId: string | null;
  contactEmail: string | null;
  contactName: string | null;
}) {
  if (kind === "email" && contactId) {
    return (
      <div className="space-y-3">
        <EmailComposer
          contactId={contactId}
          contactEmail={contactEmail}
          contactName={contactName}
          recommendationId={recommendationId}
        />
        <StatusActions id={recommendationId} />
      </div>
    );
  }

  if (kind === "call" && contactId) {
    return (
      <div className="space-y-3">
        <CallBriefingPanel contactId={contactId} />
        <StatusActions id={recommendationId} />
      </div>
    );
  }

  return <StatusActions id={recommendationId} />;
}

function CallBriefingPanel({ contactId }: { contactId: string }) {
  const [briefing, setBriefing] = useState<null | {
    goal: string;
    talking_points: string[];
    questions: string[];
    objections: { objection: string; response: string }[];
  }>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState("");

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/call/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contactId, hint }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Fehler");
      setBriefing(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-3 p-6">
      <h2 className="text-lg font-semibold text-brand-900">Telefonat-Briefing</h2>
      <input
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        className="input"
        placeholder="Hinweis für die Vorbereitung (optional)"
      />
      <button onClick={generate} disabled={loading} className="btn-secondary">
        {loading ? "Generiere…" : "✨ Briefing erstellen"}
      </button>
      {error && <div className="text-sm text-rose-600">{error}</div>}
      {briefing && (
        <div className="space-y-4 text-sm">
          <div>
            <div className="text-xs uppercase text-brand-500">Ziel</div>
            <div className="text-brand-900">{briefing.goal}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-brand-500">Kernbotschaften</div>
            <ul className="ml-4 list-disc text-brand-900">
              {briefing.talking_points.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs uppercase text-brand-500">Fragen</div>
            <ul className="ml-4 list-disc text-brand-900">
              {briefing.questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
          {briefing.objections?.length > 0 && (
            <div>
              <div className="text-xs uppercase text-brand-500">Einwände</div>
              <ul className="space-y-2">
                {briefing.objections.map((o, i) => (
                  <li key={i} className="rounded-md border border-brand-100 bg-brand-50 p-3">
                    <div className="font-medium text-brand-900">{o.objection}</div>
                    <div className="text-brand-700">{o.response}</div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function set(status: RecommendationStatus) {
    setPending(true);
    await fetch(`/api/recommendations/${id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    router.push("/recommendations");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <button onClick={() => set("erledigt")} disabled={pending} className="btn-ghost">
        Als erledigt markieren
      </button>
      <button onClick={() => set("aufgeschoben")} disabled={pending} className="btn-ghost">
        Aufschieben
      </button>
      <button onClick={() => set("verworfen")} disabled={pending} className="btn-ghost text-rose-700 hover:bg-rose-50">
        Verwerfen
      </button>
    </div>
  );
}
