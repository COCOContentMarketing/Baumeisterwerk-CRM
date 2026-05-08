import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabase/server";

async function signOutAndRedirect(req: NextRequest) {
  const sb = await getSupabaseServer();
  await sb.auth.signOut();
  return NextResponse.redirect(new URL("/login", req.url));
}

// Form-Submit aus dem Header (POST) UND direkter Aufruf (GET, falls jemand
// /logout im Browser oeffnet) sind beide unterstuetzt.
export async function POST(req: NextRequest) {
  return signOutAndRedirect(req);
}

export async function GET(req: NextRequest) {
  return signOutAndRedirect(req);
}
