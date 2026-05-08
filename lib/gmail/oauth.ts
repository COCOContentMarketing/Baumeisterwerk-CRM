import { google } from "googleapis";

export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/userinfo.email",
];

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
