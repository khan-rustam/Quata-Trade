"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Check, Loader2, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Guided camera capture for identity documents.
 *
 * ## Why this exists
 *
 * The previous flow was a bare `<input type="file">`. On a phone that opens a
 * wide-open picker with no guidance, so people photograph an ID at an angle,
 * half out of frame, or upside down — and the reviewer rejects it, which costs
 * the applicant a round trip and costs us a verification.
 *
 * The frame here is not decoration. It is drawn at the real ID-1 aspect ratio
 * (85.60 × 53.98 mm, the ISO/IEC 7810 size every national ID, driving licence
 * and bank card in the world uses), so "fill the box" produces a straight,
 * complete, correctly-proportioned photo of the actual document.
 *
 * ## Cropping is deliberate
 *
 * The captured frame is cropped to the guide rectangle rather than saved whole.
 * The reviewer gets the document, not the kitchen table it was lying on, and
 * the upload is smaller on a mobile connection. What the user framed is exactly
 * what gets sent — no surprise on the review screen.
 *
 * ## Never trap the user
 *
 * Camera access fails for ordinary reasons: a denied permission, a desktop with
 * no camera, an in-app browser that blocks `getUserMedia`, an insecure origin.
 * Every one of those calls `onFallback()` so the plain file picker takes over.
 * A KYC step that dead-ends because the camera would not start is a lost
 * customer, and it is not their fault.
 */

/** ISO/IEC 7810 ID-1 — 85.60 mm × 53.98 mm. */
const ID1_ASPECT = 85.6 / 53.98;

/** Selfies frame a face, not a card, so they get a portrait-ish window. */
const SELFIE_ASPECT = 3 / 4;

export type CameraFacing = "environment" | "user";

export function DocumentCamera({
  open,
  facing,
  title,
  hint,
  onCapture,
  onClose,
  onFallback,
}: {
  open: boolean;
  /** "environment" for documents (rear lens), "user" for the selfie. */
  facing: CameraFacing;
  title: string;
  hint: string;
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Called when the camera cannot be used at all — caller opens the picker. */
  onFallback: (reason: string) => void;
}): React.JSX.Element | null {
  const tx = useTranslations("documentCamera");
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const pendingRef = useRef<File | null>(null);

  const aspect = facing === "user" ? SELFIE_ASPECT : ID1_ASPECT;

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  // Start / stop the stream with the dialog. The cleanup is the important half:
  // a camera left running keeps the indicator light on and drains the battery,
  // and on some Android browsers blocks the next getUserMedia call entirely.
  useEffect(() => {
    // No `stop()` here for the closed case — the cleanup below already ran when
    // `open` flipped. Calling setState in an effect BODY triggers cascading
    // renders (and the lint rule that catches it); doing the teardown in the
    // cleanup is both correct and the idiomatic place for it.
    if (!open) return;
    let cancelled = false;

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        onFallback("unsupported");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            // `ideal`, not `exact`: a laptop with only a front camera should
            // still work rather than throwing OverconstrainedError.
            facingMode: { ideal: facing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        // `ready` is set by the video's onCanPlay below — subscribing to the
        // element's event is what the effect is FOR, and it is also more
        // truthful than flipping a flag after play() resolves: play() can
        // resolve before the first frame is decodable.
      } catch (err) {
        const name = err instanceof Error ? err.name : "unknown";
        // NotAllowedError (denied), NotFoundError (no camera),
        // NotReadableError (in use). All mean the same thing to the user:
        // use the picker instead.
        onFallback(name);
      }
    })();

    return () => {
      cancelled = true;
      stop();
      setReady(false);
    };
  }, [open, facing, onFallback, stop]);

  const shoot = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    setBusy(true);

    // Crop to the same rectangle the guide drew, computed in VIDEO pixels so
    // the output matches what the user framed regardless of screen size.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    let cw = vw * 0.9;
    let ch = cw / aspect;
    if (ch > vh * 0.9) {
      ch = vh * 0.9;
      cw = ch * aspect;
    }
    const sx = (vw - cw) / 2;
    const sy = (vh - ch) / 2;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(cw);
    canvas.height = Math.round(ch);
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setBusy(false);
      onFallback("canvas");
      return;
    }
    // The front camera preview is mirrored so it feels like a mirror; the
    // SAVED image must not be, or every selfie arrives back-to-front and text
    // on a held document reads in reverse.
    if (facing === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, sx, sy, cw, ch, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        setBusy(false);
        if (!blob) {
          onFallback("encode");
          return;
        }
        pendingRef.current = new File([blob], `capture-${facing}.jpg`, { type: "image/jpeg" });
        setPreview(canvas.toDataURL("image/jpeg", 0.9));
      },
      "image/jpeg",
      // 0.9 keeps text on an ID legible while staying well under the 5 MB cap
      // on a mobile connection.
      0.9,
    );
  }, [aspect, facing, onFallback]);

  const accept = () => {
    const file = pendingRef.current;
    if (!file) return;
    pendingRef.current = null;
    setPreview(null);
    stop();
    onCapture(file);
  };

  const retake = () => {
    pendingRef.current = null;
    setPreview(null);
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex flex-col bg-black/95"
    >
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm font-medium text-white">{title}</span>
        <button
          type="button"
          onClick={() => {
            stop();
            onClose();
          }}
          aria-label={tx("close")}
          className="flex h-11 w-11 items-center justify-center rounded-full text-white/80 hover:bg-white/10"
        >
          <X size={20} />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {preview ? (
          /* A data: URI straight off the canvas — next/image cannot optimise
             it and would only add a round trip. */
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={tx("previewAlt")} className="max-h-full max-w-full object-contain" />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              onCanPlay={() => setReady(true)}
              className={cn("h-full w-full object-cover", facing === "user" && "-scale-x-100")}
            />
            {/* The guide. `outline` with a huge spread dims everything outside
                the frame in one element — no four-panel overlay to keep aligned. */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div
                style={{ aspectRatio: String(aspect) }}
                className="w-[90%] max-w-3xl rounded-xl shadow-[0_0_0_100vmax_rgba(0,0,0,0.55)]"
              >
                <div className="h-full w-full rounded-xl border-2 border-white/90" />
              </div>
            </div>
          </>
        )}
        {!ready && !preview && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-white/70" />
          </div>
        )}
      </div>

      <div className="space-y-3 px-4 pb-8 pt-4">
        <p className="text-center text-sm text-white/70">{preview ? tx("reviewHint") : hint}</p>
        {preview ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={retake}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-white/25 text-sm font-medium text-white"
            >
              <RotateCcw size={16} /> {tx("retake")}
            </button>
            <button
              type="button"
              onClick={accept}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-accent-400 text-sm font-semibold text-black"
            >
              <Check size={16} /> {tx("usePhoto")}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={shoot}
            disabled={!ready || busy}
            aria-label={tx("shutter")}
            className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white text-black disabled:opacity-40"
          >
            {busy ? <Loader2 size={22} className="animate-spin" /> : <Camera size={24} />}
          </button>
        )}
      </div>
    </div>
  );
}
