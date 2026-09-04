"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { extractRoomCode } from "@/lib/roomCode";
import { Button } from "./ui";

/** Decode at this width. Full sensor resolution is wasted work on a phone. */
const SAMPLE_WIDTH = 480;

type Failure =
  | "insecure"
  | "denied"
  | "no-camera"
  | "unsupported"
  | "unknown"
  | null;

/**
 * In-app QR scanning, so joining doesn't mean leaving for the camera app.
 *
 * Decoding is done with jsQR on both platforms rather than the native
 * BarcodeDetector, which Safari doesn't implement. One code path means the scan
 * behaves identically on every phone at the table — the same reasoning that
 * rules out audio and vibration elsewhere in this app.
 */
export default function QrScanner({
  onCode,
  onClose,
}: {
  onCode: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const doneRef = useRef(false);

  const [failure, setFailure] = useState<Failure>(null);
  const [sawSomething, setSawSomething] = useState(false);

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  useEffect(() => {
    let cancelled = false;

    // getUserMedia is gated on a secure context. Over plain http on a LAN
    // address — exactly how this gets tested with real phones — the API simply
    // isn't there, so say so instead of failing mysteriously.
    if (typeof window !== "undefined" && !window.isSecureContext) {
      setFailure("insecure");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setFailure("unsupported");
      return;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        // iOS refuses to play inline without this and will otherwise try to
        // take over the screen with a native player.
        video.setAttribute("playsinline", "true");
        await video.play();

        const jsQR = (await import("jsqr")).default;

        const tick = () => {
          if (cancelled || doneRef.current) return;
          frameRef.current = requestAnimationFrame(tick);

          if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) return;
          const scale = SAMPLE_WIDTH / video.videoWidth;
          if (!Number.isFinite(scale) || scale <= 0) return;

          canvas.width = SAMPLE_WIDTH;
          canvas.height = Math.round(video.videoHeight * scale);
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

          const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const found = jsQR(image.data, image.width, image.height, {
            inversionAttempts: "dontInvert",
          });
          if (!found?.data) return;

          const code = extractRoomCode(found.data);
          if (!code) {
            // A QR, but not one of ours. Keep scanning and say why.
            setSawSomething(true);
            return;
          }
          doneRef.current = true;
          stop();
          onCode(code);
        };

        frameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        if (cancelled) return;
        const name = err instanceof Error ? err.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") setFailure("denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setFailure("no-camera");
        } else setFailure("unknown");
      }
    }

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [onCode, stop]);

  const message: Record<NonNullable<Failure>, string> = {
    insecure:
      "The camera only works over HTTPS. On a local network address, type the room code instead.",
    denied:
      "Camera access was refused. Allow it in your browser settings, or type the room code instead.",
    "no-camera": "No camera found on this device.",
    unsupported: "This browser can't open the camera. Type the room code instead.",
    unknown: "Couldn't start the camera. Type the room code instead.",
  };

  return (
    <div
      role="dialog"
      aria-label="Scan a room QR code"
      className="fixed inset-0 z-[70] flex flex-col bg-void"
    >
      <div className="flex items-center justify-between gap-3 p-4">
        <span className="font-display text-[11px] tracking-widest text-cyan">
          SCAN TO JOIN
        </span>
        <button
          type="button"
          onClick={() => {
            stop();
            onClose();
          }}
          className="min-h-11 px-3 font-display text-[10px] tracking-wider text-ash uppercase"
        >
          Cancel
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        {failure ? (
          <div className="flex h-full items-center justify-center p-6">
            <p className="max-w-xs text-center text-ash">{message[failure]}</p>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              muted
              playsInline
              className="size-full object-cover"
            />
            {/* Reticle. Purely decorative — jsQR reads the whole frame. */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <div className="size-56 border-4 border-cyan/80 shadow-[0_0_0_100vmax_rgba(7,6,13,0.55)]" />
            </div>
          </>
        )}
      </div>

      <div className="space-y-3 p-4">
        <p className="text-center text-[16px] text-ash">
          {failure
            ? "You can still join with the code."
            : sawSomething
              ? "That QR isn't a room code — point it at the one on someone's screen."
              : "Point at the QR on someone else's phone."}
        </p>
        <Button tone="ghost" onClick={() => {
          stop();
          onClose();
        }}>
          Enter a code instead
        </Button>
      </div>
    </div>
  );
}
