import { NextResponse } from "next/server";
import { readToken, resolveCaller } from "@/lib/server/handler";
import { history } from "@/lib/server/store";

/**
 * Words already played. Authed, so a room's history isn't scrapeable by anyone
 * who merely knows the code — and it only ever contains revealed rounds, so it
 * cannot expose a live answer.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const resolved = await resolveCaller(code, readToken(request));
  if ("response" in resolved) return resolved.response;

  return NextResponse.json({ history: await history(resolved.room.id) });
}
