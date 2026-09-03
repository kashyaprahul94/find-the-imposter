"use client";

import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Panel } from "./ui";

/**
 * Collapsed by default: the QR matters for about ten seconds at the start of a
 * night, and a 170px block pinned above the player list the rest of the time is
 * just in the way.
 */
export default function SharePanel({ code }: { code: string }) {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // window.location, not an env var: the join link has to match whatever host
  // the room creator is actually on (localhost, a LAN IP, or the Vercel domain).
  useEffect(() => {
    setUrl(`${window.location.origin}/room/${code}`);
  }, [code]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard needs a secure context; over plain http the QR is the fallback.
      setCopied(false);
    }
  }

  return (
    <Panel className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-display text-[9px] tracking-widest text-ash">INVITE</p>
          <p className="font-display text-sm tracking-[0.3em] text-bone">{code}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="btn-arcade min-h-11 bg-cyan/10 px-3 py-2 font-display text-[9px] tracking-wider text-cyan uppercase"
        >
          {open ? "Hide QR" : "QR"}
        </button>
        <button
          type="button"
          onClick={copy}
          disabled={!url}
          className="btn-arcade min-h-11 bg-transparent px-3 py-2 font-display text-[9px] tracking-wider text-ash uppercase disabled:opacity-40"
        >
          {copied ? "Copied" : "Link"}
        </button>
      </div>

      {open ? (
        <div className="settle flex flex-col items-center gap-2 pt-1">
          <div className="border-4 border-cyan bg-white p-3">
            {url ? <QRCodeSVG value={url} size={176} level="M" marginSize={0} /> : null}
          </div>
          <p className="text-[16px] text-ash">Point a camera at it.</p>
        </div>
      ) : null}
    </Panel>
  );
}
