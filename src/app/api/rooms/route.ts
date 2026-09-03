import { NextResponse } from "next/server";
import { createRoom } from "@/lib/server/store";
import { fail } from "@/lib/server/handler";

export async function POST() {
  try {
    const room = await createRoom();
    return NextResponse.json({ code: room.code });
  } catch (err) {
    return fail(err instanceof Error ? err.message : "Could not create a room.", 500);
  }
}
