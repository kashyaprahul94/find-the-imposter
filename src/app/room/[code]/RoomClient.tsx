"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, ErrorNote, Field, Logo, Panel } from "@/components/ui";
import { fetchRoom } from "@/lib/rooms";
import { MAX_NAME_LENGTH } from "@/lib/constants";
import {
	clearSession,
	lastUsedName,
	loadSession,
	sanitizeName,
	startSession,
	type RoomSession,
} from "@/lib/session";
import RoomView from "@/components/RoomView";

type Phase = "checking" | "missing" | "unreachable" | "naming" | "playing";

export default function RoomClient({ code }: { code: string }) {
	const [phase, setPhase] = useState<Phase>("checking");
	const [session, setSession] = useState<RoomSession | null>(null);
	const [draftName, setDraftName] = useState("");
	const [creatorKey, setCreatorKey] = useState<string | null>(null);

	const enter = useCallback(
		(name: string) => {
			setSession(startSession(code, name));
			setPhase("playing");
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

		// Strip the name out of the address bar once read. Otherwise a player who
		// copies the URL from their browser hands the next person a link that
		// silently joins under *their* name, arriving as "John (2)".
		if (fromHome !== null) {
			const url = new URL(window.location.href);
			url.searchParams.delete("name");
			window.history.replaceState(null, "", `${url.pathname}${url.search}`);
		}

		fetchRoom(code)
			.then((room) => {
				if (cancelled) return;
				if (!room) return setPhase("missing");
				setCreatorKey(room.creatorKey);

				// Already joined this room on this device — a refresh or an iOS tab
				// restore. Go straight back in.
				if (stored) return enter(stored.name);
				// Coming from our own home form, where the name was just typed.
				const passed = sanitizeName(fromHome ?? "");
				if (passed) return enter(passed);
				// A scanned QR or a pasted link: always ask.
				setPhase("naming");
			})
			.catch(() => {
				if (!cancelled) setPhase("unreachable");
			});

		return () => {
			cancelled = true;
		};
	}, [code, enter]);

	const leave = useCallback(() => clearSession(code), [code]);

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
								Room <span className="text-bone">{code}</span> was never
								created, or the code is a typo.
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
		return (
			<RoomView
				code={code}
				session={session}
				creatorKey={creatorKey}
				onLeave={leave}
			/>
		);
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
						placeholder="e.g. John"
						autoFocus
						autoComplete="off"
						autoCapitalize="words"
						enterKeyHint="go"
						hint="This is how everyone in the room sees you."
						onKeyDown={(e) => {
							if (e.key === "Enter" && clean) enter(clean);
						}}
					/>
					<Button tone="neon" disabled={!clean} onClick={() => enter(clean)}>
						Join
					</Button>
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
