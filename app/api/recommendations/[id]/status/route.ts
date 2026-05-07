import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { setRecommendationStatus } from "@/lib/db/mutations";

const Body = z.object({
  status: z.enum(["offen", "erledigt", "verworfen", "aufgeschoben"]),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = Body.parse(await req.json());
  await setRecommendationStatus(id, parsed.status);
  return NextResponse.json({ ok: true });
}
