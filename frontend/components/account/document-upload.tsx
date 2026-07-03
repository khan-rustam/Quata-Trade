"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Upload, X } from "lucide-react";
import { KYC_UPLOAD_MIMES } from "@quatatrade/shared";
import { api } from "@/lib/api/client";
import { apiErrorMessage } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

const MAX_BYTES = 5 * 1024 * 1024;

/** Single document slot: pick → validate (type/size) → base64 → upload → key. */
export function DocumentUpload({
  label,
  onUploaded,
  onCleared,
}: {
  label: string;
  onUploaded: (key: string) => void;
  onCleared: () => void;
}): React.JSX.Element {
  const tx = useTranslations("documentUpload");
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState<string>();

  const pick = () => inputRef.current?.click();

  const onFile = async (file: File) => {
    setError(null);
    if (!(KYC_UPLOAD_MIMES as readonly string[]).includes(file.type)) {
      setError(tx("errWrongType"));
      setState("error");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(tx("errTooLarge"));
      setState("error");
      return;
    }
    setState("uploading");
    setName(file.name);
    try {
      const base64 = await toBase64(file);
      const { key } = await api.kycUpload({ fileBase64: base64, mime: file.type as (typeof KYC_UPLOAD_MIMES)[number] });
      onUploaded(key);
      setState("done");
    } catch (err) {
      setError(apiErrorMessage(err, tx("errUploadFailed")));
      setState("error");
    }
  };

  const clear = () => {
    setState("idle");
    setName(undefined);
    setError(null);
    onCleared();
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <button
        type="button"
        onClick={state === "done" ? undefined : pick}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl border border-dashed px-4 py-3 text-left transition-colors",
          state === "done" ? "border-success/40 bg-success/5" : state === "error" ? "border-danger/40" : "border-border hover:bg-surface-2",
        )}
      >
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            state === "done" ? "bg-success/15 text-success" : "bg-surface-2 text-text-2",
          )}
        >
          {state === "uploading" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : state === "done" ? (
            <Check size={18} />
          ) : (
            <Upload size={18} />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-text-1">{label}</span>
          <span className="block truncate text-xs text-text-3">
            {state === "done" ? name : state === "uploading" ? tx("uploading") : tx("hint")}
          </span>
        </span>
        {state === "done" && (
          <span
            role="button"
            tabIndex={0}
            aria-label={tx("removeFile")}
            onClick={(e) => {
              e.stopPropagation();
              clear();
            }}
            className="rounded-md p-1 text-text-3 hover:text-danger"
          >
            <X size={16} />
          </span>
        )}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") return reject(new Error("read failed"));
      resolve(result.split(",")[1] ?? ""); // strip data: prefix
    };
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}
