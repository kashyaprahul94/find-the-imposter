"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorNote, Field, Logo, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/roomCode";
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from "@/lib/constants";
import { lastUsedName, sanitizeName } from "@/lib/session";

type Busy = "none" | "creating" | "joining";

export default function Home() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<Busy>("none");
  const [error, setError] = useState<string | null>(null);

  // Read after mount so the server-rendered HTML and the first client render
  // agree; localStorage doesn't exist during prerender.
  useEffect(() => {
    setName(lastUsedName());
  }, []);

  const cleanName = sanitizeName(name);

  async function handleCreate() {
    if (!cleanName) return setError("Enter your name first.");
    setBusy("creating");
    setError(null);
    try {
      const { code: newCode } = await api.createRoom();
      router.push(`/room/${newCode}?name=${encodeURIComponent(cleanName)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the room.");
      setBusy("none");
    }
  }

  async function handleJoin() {
    if (!cleanName) return setError("Enter your name first.");
    const normalized = normalizeRoomCode(code);
    if (!isValidRoomCode(normalized)) {
      return setError(`Room codes are ${ROOM_CODE_LENGTH} characters — no O, I, 0 or 1.`);
    }
    setBusy("joining");
    setError(null);
    try {
      if (!(await api.roomExists(normalized))) {
        setError(`No room called ${normalized}. Check the code.`);
        setBusy("none");
        return;
      }
      router.push(`/room/${normalized}?name=${encodeURIComponent(cleanName)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reach the room.");
      setBusy("none");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 p-5">
      <header className="space-y-2 text-center">
        <Logo />
        <p className="text-ash">Everyone gets a word. One of you doesn&apos;t.</p>
      </header>

      <Panel className="space-y-4">
        <Field
          label="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Rahul"
          autoComplete="off"
          autoCapitalize="words"
          enterKeyHint="done"
        />
        <Button tone="neon" onClick={handleCreate} disabled={busy !== "none"}>
          {busy === "creating" ? "Opening room…" : "Create room"}
        </Button>
      </Panel>

      <div className="flex items-center gap-3 text-ash">
        <span className="h-px flex-1 bg-edge" />
        <span className="font-display text-[10px] tracking-widest">OR JOIN</span>
        <span className="h-px flex-1 bg-edge" />
      </div>

      <Panel className="space-y-4">
        <Field
          label="Room code"
          value={code}
          onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
          placeholder="ABC42"
          inputMode="text"
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleJoin();
          }}
          className="text-center font-display text-base tracking-[0.4em]"
        />
        <Button tone="cyan" onClick={handleJoin} disabled={busy !== "none"}>
          {busy === "joining" ? "Joining…" : "Join room"}
        </Button>
      </Panel>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <p className="text-center text-[15px] text-ash">
        Scanned a QR code? It takes you straight in.
      </p>
    </main>
  );
}
