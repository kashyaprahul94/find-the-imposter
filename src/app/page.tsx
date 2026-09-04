"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, ErrorNote, Field, Logo, Panel } from "@/components/ui";
import QrScanner from "@/components/QrScanner";
import { createRoom, fetchRoom } from "@/lib/rooms";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/roomCode";
import { MAX_NAME_LENGTH, ROOM_CODE_LENGTH } from "@/lib/constants";
import { lastUsedName, newPlayerKey, sanitizeName, startSession } from "@/lib/session";

type Busy = "none" | "creating" | "joining";

export default function Home() {
	const router = useRouter();
	const [name, setName] = useState("");
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState<Busy>("none");
	const [error, setError] = useState<string | null>(null);
	const [scanning, setScanning] = useState(false);

	// Read after mount so the prerendered HTML and the first client render agree;
	// localStorage doesn't exist during prerender.
	useEffect(() => {
		setName(lastUsedName());
	}, []);

	const cleanName = sanitizeName(name);
	const named = cleanName.length > 0;
	const codeReady = isValidRoomCode(normalizeRoomCode(code));

	async function handleCreate() {
		setBusy("creating");
		setError(null);
		try {
			// The key is minted before the room so the row can record who opened
			// it — that person is the one nobody can remove.
			const key = newPlayerKey();
			const newCode = await createRoom(key);
			startSession(newCode, cleanName, key);
			router.push(`/room/${newCode}`);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Could not create the room.",
			);
			setBusy("none");
		}
	}

	/**
	 * A scanned code skips the name gate here — the room page will ask, exactly
	 * as it does for someone who scanned with their phone's camera app.
	 */
	async function handleScanned(scanned: string) {
		setScanning(false);
		setCode(scanned);
		setBusy("joining");
		setError(null);
		try {
			if (!(await fetchRoom(scanned))) {
				setError(`Scanned ${scanned}, but there's no room with that code.`);
				setBusy("none");
				return;
			}
			router.push(
				cleanName
					? `/room/${scanned}?name=${encodeURIComponent(cleanName)}`
					: `/room/${scanned}`,
			);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not reach the room.");
			setBusy("none");
		}
	}

	async function handleJoin() {
		const normalized = normalizeRoomCode(code);
		if (!isValidRoomCode(normalized)) {
			return setError(
				`Room codes are ${ROOM_CODE_LENGTH} characters — no O, I, 0 or 1.`,
			);
		}
		setBusy("joining");
		setError(null);
		try {
			if (!(await fetchRoom(normalized))) {
				setError(`No room called ${normalized}. Check the code.`);
				setBusy("none");
				return;
			}
			router.push(`/room/${normalized}?name=${encodeURIComponent(cleanName)}`);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Could not reach the room.",
			);
			setBusy("none");
		}
	}

	return (
		<main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-5 p-5">
			<header className="space-y-2 text-center">
				<Logo />
				<p className="text-ash">
					Everyone gets a word. One of you doesn&apos;t.
				</p>
			</header>

			{/* Identity first: it applies to both actions below, so it can't sit
          inside either one of them. */}
			<Panel className="space-y-2">
				<Field
					label="Your name"
					value={name}
					onChange={(e) => setName(e.target.value)}
					maxLength={MAX_NAME_LENGTH}
					placeholder="e.g. John"
					autoComplete="off"
					autoCapitalize="words"
					enterKeyHint="done"
					hint="This is how everyone in the room sees you."
				/>
			</Panel>

			<div aria-live="polite">
				{!named ? (
					<p className="text-center text-[17px] text-amber">
						Enter your name to create or join a room.
					</p>
				) : null}
			</div>

			<Panel className="space-y-4">
				<Button
					tone="neon"
					onClick={handleCreate}
					disabled={!named || busy !== "none"}
				>
					{busy === "creating" ? "Opening room…" : "Create a room"}
				</Button>

				<div className="flex items-center gap-3 text-ash">
					<span className="h-px flex-1 bg-edge" />
					<span className="font-display text-[10px] tracking-widest">
						OR JOIN ONE
					</span>
					<span className="h-px flex-1 bg-edge" />
				</div>

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
						if (e.key === "Enter" && named && codeReady) void handleJoin();
					}}
					className="text-center font-display text-base tracking-[0.4em]"
				/>
				<Button
					tone="cyan"
					onClick={handleJoin}
					disabled={!named || !codeReady || busy !== "none"}
				>
					{busy === "joining" ? "Joining…" : "Join room"}
				</Button>

				{/* Not gated on the name: scanning is the fastest path in, and the
				    room page prompts for a name anyway. */}
				<button
					type="button"
					onClick={() => {
						setError(null);
						setScanning(true);
					}}
					disabled={busy !== "none"}
					className="min-h-12 w-full font-display text-[9px] tracking-wider text-cyan uppercase underline disabled:opacity-40"
				>
					Scan a QR code
				</button>
			</Panel>

			{error ? <ErrorNote>{error}</ErrorNote> : null}

			<p className="text-center text-[15px] text-ash">
				Scanning takes you straight to the room — it&apos;ll ask your name
				there.
			</p>

			{scanning ? (
				<QrScanner onCode={handleScanned} onClose={() => setScanning(false)} />
			) : null}
		</main>
	);
}
