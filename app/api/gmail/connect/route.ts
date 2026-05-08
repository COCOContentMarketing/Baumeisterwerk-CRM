import { NextResponse } from "next/server";
import { buildAuthUrl } from "@/lib/gmail/oauth";

export async function GET() {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return NextResponse.json(
      { error: "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET nicht gesetzt" },
      { status: 500 },
    );
  }
  if (!process.env.GOOGLE_REDIRECT_URI) {
    return NextResponse.json(
      { error: "GOOGLE_REDIRECT_URI nicht gesetzt" },
      { status: 500 },
    );
  }
  const url = buildAuthUrl("connect");
  return NextResponse.redirect(url);
}
