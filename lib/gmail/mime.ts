// MIME-Builder fuer Gmail. Wir bauen RFC-822-Messages selbst, weil googleapis
// dafuer nichts mitbringt.
//
// Encoding-Regeln, die hier eingehalten werden muessen:
//   - Subject mit Non-ASCII: RFC 2047 B-Encoding (=?UTF-8?B?...?=)
//   - Display-Name in From/To mit Non-ASCII: ebenso RFC 2047
//   - Body: charset="UTF-8" + Content-Transfer-Encoding: base64
//     (Body-Bytes werden zu Base64 umgewandelt -> komplette Message ist ASCII)
//   - Multipart-Boundary: ASCII
//
// Die fertige Message wird vom Caller als ganzes per
//   Buffer.from(raw, 'utf8').toString('base64url')
// an Gmail uebergeben.

const RFC2047_THRESHOLD = /[^\x20-\x7e]/; // alles ausser Basic-ASCII

/** RFC 2047 B-Encoding fuer einen einzelnen Header-Value. */
export function encodeRfc2047(value: string): string {
  if (!RFC2047_THRESHOLD.test(value)) return value;
  const b64 = Buffer.from(value, "utf-8").toString("base64");
  return `=?UTF-8?B?${b64}?=`;
}

/** Email-Header "Display Name <addr@domain>" mit RFC-2047-Encoding falls noetig. */
export function formatAddress(email: string, displayName?: string | null): string {
  if (!displayName) return email;
  return `${encodeRfc2047(displayName)} <${email}>`;
}

/**
 * Splittet einen Base64-String in 76-Zeichen-Zeilen, wie es RFC 2045
 * fuer Content-Transfer-Encoding: base64 vorsieht.
 */
function chunkBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
}

function encodeBodyBase64(text: string): string {
  return chunkBase64(Buffer.from(text, "utf-8").toString("base64"));
}

export interface MimeMessageInput {
  from: { email: string; name?: string | null };
  to: { email: string; name?: string | null };
  subject: string;
  bodyText: string;
  bodyHtml?: string;
  /** Optional zusaetzliche Header (z.B. In-Reply-To). */
  extraHeaders?: Record<string, string>;
}

export function buildMimeMessage(input: MimeMessageInput): string {
  const headers: string[] = [
    `From: ${formatAddress(input.from.email, input.from.name)}`,
    `To: ${formatAddress(input.to.email, input.to.name)}`,
    `Subject: ${encodeRfc2047(input.subject)}`,
    "MIME-Version: 1.0",
  ];
  if (input.extraHeaders) {
    for (const [k, v] of Object.entries(input.extraHeaders)) {
      headers.push(`${k}: ${encodeRfc2047(v)}`);
    }
  }

  if (input.bodyHtml) {
    const boundary = `=_BMW_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    const parts = [
      "",
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      encodeBodyBase64(input.bodyText),
      "",
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      encodeBodyBase64(input.bodyHtml),
      "",
      `--${boundary}--`,
      "",
    ];
    return [...headers, ...parts].join("\r\n");
  }

  headers.push('Content-Type: text/plain; charset="UTF-8"');
  headers.push("Content-Transfer-Encoding: base64");
  return [...headers, "", encodeBodyBase64(input.bodyText)].join("\r\n");
}

/** Wandelt eine fertige RFC-822-Message in das Gmail-API-erwartete base64url-Format. */
export function toBase64Url(rfc822: string): string {
  return Buffer.from(rfc822, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
