import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/gmail/oauth";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return NextResponse.json({ error: "Google OAuth nicht konfiguriert" }, { status: 500 });
  }
  const url = buildAuthUrl("connect");
  return NextResponse.redirect(url);
}
