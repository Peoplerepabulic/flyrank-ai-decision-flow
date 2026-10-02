import { NextRequest, NextResponse } from "next/server";
import { getRun } from "@/lib/runStore";

/** GET /api/runs/[id] — polled by the client for live status, log, and results. */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const run = getRun(params.id);
  if (!run) return NextResponse.json({ error: "Run not found." }, { status: 404 });
  return NextResponse.json(run);
}
