import { notFound } from "next/navigation";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/roomCode";
import RoomClient from "./RoomClient";

export default async function RoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const normalized = normalizeRoomCode(decodeURIComponent(code));

  // Malformed codes never touch the network — straight to 404.
  if (!isValidRoomCode(normalized)) notFound();

  return <RoomClient code={normalized} />;
}
