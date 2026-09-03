import { NextResponse } from "next/server";
import { resolveRoom } from "@/lib/server/handler";

/** Existence check for the join form and the room page. Deliberately unauthed. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const resolved = await resolveRoom(code);
  if ("response" in resolved) return resolved.response;
  return NextResponse.json({ code: resolved.room.code });
}
