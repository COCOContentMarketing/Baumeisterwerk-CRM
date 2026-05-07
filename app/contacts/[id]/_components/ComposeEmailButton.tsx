"use client";

import { useState, useEffect } from "react";
import { EmailComposer } from "@/components/EmailComposer";

export function ComposeEmailButton({ contactId }: { contactId: string }) {
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState<{ email: string; full_name: string | null } | null>(null);

  useEffect(() => {
    if (!open || contact) return;
    fetch(`/api/contacts/${contactId}`)
      .then((r) => r.json())
      .then(setContact)
      .catch(() => setContact(null));
  }, [open, contact, contactId]);

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-primary">
        ✉️ Email entwerfen
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/30 p-8">
          <div className="w-full max-w-2xl">
            {contact ? (
              <EmailComposer
                contactId={contactId}
                contactEmail={contact.email}
                contactName={contact.full_name}
                onClose={() => setOpen(false)}
              />
            ) : (
              <div className="card p-6 text-center text-sm text-brand-500">Lade…</div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
