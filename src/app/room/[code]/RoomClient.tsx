"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, ErrorNote, Field, Logo, Panel } from "@/components/ui";
import { api } from "@/lib/api";
import { MAX_NAME_LENGTH } from "@/lib/constants";
import {
  clearSession,
  lastUsedName,
  loadSession,
  sanitizeName,
  saveSession,
  type RoomSession,
} from "@/lib/session";
import RoomView from "@/components/RoomView";

type Phase = "checking" | "missing" | "unreachable" | "naming" | "playing";

export default function RoomClient({ code }: { code: string }) {
  const [phase, setPhase] = useState<Phase>("checking");
  const [session, setSession] = useState<RoomSession | null>(null);
  const [draftName, setDraftName] = useState("");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);

  const join = useCallback(
    async (name: string, existingToken: string | null) => {
      setJoining(true);
      setJoinError(null);
      try {
        const result = await api.join(code, name, existingToken);
        const next: RoomSession = {
          token: result.token,
          playerKey: result.playerKey,
          name: result.name,
        };
        saveSession(code, next);
        setSession(next);
        setPhase("playing");
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : "Could not join.");
        setPhase("naming");
      } finally {
        setJoining(false);
      }
    },
    [code],
  );

  useEffect(() => {
    let cancelled = false;

    // Read from window rather than useSearchParams so this component needs no
    // Suspense boundary.
    const fromHome = new URLSearchParams(window.location.search).get("name");
    const stored = loadSession(code);
    setDraftName(sanitizeName(fromHome ?? stored?.name ?? lastUsedName()));

    api
      .roomExists(code)
      .then(async (exists) => {
        if (cancelled) return;
        if (!exists) return setPhase("missing");

        // A stored token means this device already belongs to this room —
        // a refresh or an iOS tab restore, so rejoin silently.
        if (stored) {
          await join(stored.name, stored.token);
          return;
        }
        // Arriving from our own home form is a deliberate action with a name
        // already typed; anything else (a scanned QR, a pasted link) gets the
        // prompt, so nobody silently joins under a name from weeks ago.
        if (fromHome && sanitizeName(fromHome)) {
          await join(sanitizeName(fromHome), null);
          return;
        }
        setPhase("naming");
      })
      .catch(() => {
        if (!cancelled) setPhase("unreachable");
      });

    return () => {
      cancelled = true;
    };
  }, [code, join]);

  const leave = useCallback(() => {
    clearSession(code);
  }, [code]);

  if (phase === "checking") {
    return (
      <Centered>
        <p className="animate-pulse font-display text-[11px] tracking-widest text-cyan">
          CONNECTING…
        </p>
      </Centered>
    );
  }

  if (phase === "missing" || phase === "unreachable") {
    return (
      <Centered>
        <Panel className="w-full space-y-4 text-center">
          <p className="font-display text-[13px] text-neon text-glow-neon">
            {phase === "missing" ? "NO SUCH ROOM" : "CAN'T CONNECT"}
          </p>
          <p className="text-ash">
            {phase === "missing" ? (
              <>
                Room <span className="text-bone">{code}</span> was never created, or the
                code is a typo.
              </>
            ) : (
              "Couldn't reach the server. Check your connection and try again."
            )}
          </p>
          <Link href="/" className="block">
            <Button tone="cyan">Back to start</Button>
          </Link>
        </Panel>
      </Centered>
    );
  }

  if (phase === "playing" && session) {
    return <RoomView code={code} session={session} onLeave={leave} />;
  }

  const clean = sanitizeName(draftName);
  return (
    <Centered>
      <div className="w-full space-y-5">
        <div className="text-center">
          <Logo />
          <p className="mt-2 text-ash">
            Joining room <span className="text-cyan">{code}</span>
          </p>
        </div>
        <Panel className="space-y-4">
          <Field
            label="Your name"
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            maxLength={MAX_NAME_LENGTH}
            placeholder="e.g. Rahul"
            autoFocus
            autoComplete="off"
            autoCapitalize="words"
            enterKeyHint="go"
            onKeyDown={(e) => {
              if (e.key === "Enter" && clean && !joining) void join(clean, null);
            }}
          />
          <Button
            tone="neon"
            disabled={!clean || joining}
            onClick={() => void join(clean, null)}
          >
            {joining ? "Joining…" : "Join"}
          </Button>
          {joinError ? <ErrorNote>{joinError}</ErrorNote> : null}
          {!clean && draftName.length > 0 ? (
            <ErrorNote>Names need at least one real character.</ErrorNote>
          ) : null}
        </Panel>
      </div>
    </Centered>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 p-5">
      {children}
    </main>
  );
}
