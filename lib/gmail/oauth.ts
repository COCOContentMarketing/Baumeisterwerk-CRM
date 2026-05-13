import { google } from "googleapis";

export const GMAIL_SCOPE_COMPOSE = "https://www.googleapis.com/auth/gmail.compose";
export const GMAIL_SCOPE_SEND = "https://www.googleapis.com/auth/gmail.send";
export const GMAIL_SCOPE_READONLY = "https://www.googleapis.com/auth/gmail.readonly";
export const GMAIL_SCOPE_USERINFO = "https://www.googleapis.com/auth/userinfo.email";

export const GMAIL_SCOPES = [
  GMAIL_SCOPE_COMPOSE,
  GMAIL_SCOPE_SEND,
  // Inbox-Sync braucht Lesezugriff auf Mails + History-API.
  GMAIL_SCOPE_READONLY,
  GMAIL_SCOPE_USERINFO,
];

/** True wenn die Liste der gewaehrten Scopes Posteingang-Lesen erlaubt. */
export function hasInboxScope(scopes: string[] | null | undefined): boolean {
  return !!scopes?.includes(GMAIL_SCOPE_READONLY);
}

export function getRedirectUri(): string {
  const uri = process.env.GOOGLE_REDIRECT_URI;
  if (!uri) {
    throw new Error("GOOGLE_REDIRECT_URI ist nicht gesetzt.");
  }
  return uri;
}

export function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getRedirectUri(),
  );
}

export function buildAuthUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES,
    state,
    redirect_uri: getRedirectUri(),
  });
}
