import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-5 p-5 text-center">
      <p className="font-display text-2xl text-neon text-glow-neon">404</p>
      <p className="text-ash">That room code doesn&apos;t look like a room code.</p>
      <Link
        href="/"
        className="btn-arcade min-h-14 w-full max-w-xs bg-cyan/10 px-5 py-4 font-display text-[11px] tracking-wider text-cyan uppercase"
      >
        Back to start
      </Link>
    </main>
  );
}
