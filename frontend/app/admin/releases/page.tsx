"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Rocket, Undo2 } from "lucide-react";
import { APP_PLATFORMS, UPDATE_TYPES, type AppPlatform, type UpdateType } from "@quatatrade/shared";
import { AdminTitle, TableFrame } from "@/components/admin/admin-ui";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input, Textarea } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { TotpActionDialog } from "@/components/admin/totp-dialog";
import { useAdminMe } from "@/hooks/use-admin";
import { usePublishRelease, useReleases, useSetReleaseStatus } from "@/hooks/use-releases";
import { apiErrorMessage } from "@/lib/api/errors";

const SEMVER = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

function typeTone(t: UpdateType): "neutral" | "warning" | "danger" {
  return t === "security" ? "danger" : t === "mandatory" ? "warning" : "neutral";
}

/**
 * Release Management. Publish a release (which every client then sees on its next
 * update check) or roll one back. SUPER_ADMIN only + TOTP step-up — a bad or forced
 * release reaches every user, so it is gated like the kill switch.
 */
export default function AdminReleasesPage(): React.JSX.Element {
  const tx = useTranslations("adminReleases");
  const toast = useToast();
  const { data: me } = useAdminMe();
  const { data, isLoading } = useReleases();
  const publish = usePublishRelease();
  const setStatus = useSetReleaseStatus();

  const [platform, setPlatform] = useState<AppPlatform>("web");
  const [updateType, setUpdateType] = useState<UpdateType>("optional");
  const [version, setVersion] = useState("");
  const [versionCode, setVersionCode] = useState("");
  const [minSupportedCode, setMinSupportedCode] = useState("");
  const [notes, setNotes] = useState("");
  // Binary platforms are rejected server-side without an artifactUrl
  // (zPublishReleaseRequest refine), and the form had no field for it — so every
  // android/ios publish 400'd after the admin had already passed the TOTP dialog.
  const [artifactUrl, setArtifactUrl] = useState("");
  const [checksum, setChecksum] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [rollbackId, setRollbackId] = useState<string | null>(null);

  const code = Number(versionCode);
  const minCode = Number(minSupportedCode);
  const isBinary = platform === "android" || platform === "ios";
  const canSubmit =
    SEMVER.test(version.trim()) &&
    (!isBinary || artifactUrl.trim().length > 0) &&
    Number.isInteger(code) &&
    code > 0 &&
    Number.isInteger(minCode) &&
    minCode > 0 &&
    minCode <= code;

  const doPublish = async (totpCode?: string): Promise<void> => {
    setError(null);
    try {
      await publish.mutateAsync({
        platform,
        version: version.trim(),
        versionCode: code,
        updateType,
        releaseNotes: notes.trim(),
        minSupportedCode: minCode,
        artifactUrl: isBinary ? artifactUrl.trim() || undefined : undefined,
        checksumSha256: isBinary ? checksum.trim() || undefined : undefined,
        totpCode,
      });
      toast.success(tx("publishedToastTitle"), tx("publishedToastBody"));
      setConfirmPublish(false);
      setVersion("");
      setVersionCode("");
      setMinSupportedCode("");
      setArtifactUrl("");
      setChecksum("");
      setNotes("");
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorPublish")));
    }
  };

  const doRollback = async (id: string, totpCode: string | undefined, reason: string): Promise<void> => {
    setError(null);
    try {
      await setStatus.mutateAsync({ id, body: { status: "rolled_back", reason, totpCode } });
      toast.success(tx("rolledBackToastTitle"), tx("rolledBackToastBody"));
      setRollbackId(null);
    } catch (err) {
      setError(apiErrorMessage(err, tx("errorRollback")));
    }
  };

  return (
    <div className="space-y-6">
      <AdminTitle title={tx("title")} subtitle={tx("subtitle")} />

      {error && <Alert tone="danger">{error}</Alert>}

      <Card className="space-y-4">
        <p className="font-medium text-text-1">{tx("publishHeading")}</p>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={tx("platform")}>
            {() => (
              <Segmented
                value={platform}
                onChange={(v) => {
                  setPlatform(v as AppPlatform);
                  // The inputs unmount for web/pwa but the payload sent them
                  // regardless: a leftover malformed URL 400s AFTER the TOTP
                  // dialog with no visible field to correct, and a well-formed
                  // one silently persists an APK url on a web release.
                  setArtifactUrl("");
                  setChecksum("");
                }}
                options={APP_PLATFORMS.map((p) => ({ value: p, label: p }))}
              />
            )}
          </Field>
          <Field label={tx("updateType")}>
            {() => (
              <Segmented
                value={updateType}
                onChange={(v) => setUpdateType(v as UpdateType)}
                options={UPDATE_TYPES.map((u) => ({ value: u, label: tx(`type_${u}`) }))}
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label={tx("version")} hint={tx("versionHint")}>
            {(p) => <Input {...p} value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.4.0" />}
          </Field>
          <Field label={tx("versionCode")} hint={tx("versionCodeHint")}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={versionCode}
                onChange={(e) => setVersionCode(e.target.value.replace(/\D/g, ""))}
                placeholder="140"
              />
            )}
          </Field>
          <Field label={tx("minSupported")} hint={tx("minSupportedHint")}>
            {(p) => (
              <Input
                {...p}
                inputMode="numeric"
                value={minSupportedCode}
                onChange={(e) => setMinSupportedCode(e.target.value.replace(/\D/g, ""))}
                placeholder="100"
              />
            )}
          </Field>
        </div>

        {/* Only meaningful for binaries: web/pwa releases ship through the deploy,
            not an artifact the client downloads. */}
        {isBinary && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tx("artifactUrl")} hint={tx("artifactUrlHint")} required>
              {(p) => (
                <Input
                  {...p}
                  value={artifactUrl}
                  onChange={(e) => setArtifactUrl(e.target.value)}
                  placeholder="https://…/quatatrade-1.2.3.apk"
                />
              )}
            </Field>
            <Field label={tx("checksum")} hint={tx("checksumHint")}>
              {(p) => (
                <Input
                  {...p}
                  value={checksum}
                  onChange={(e) => setChecksum(e.target.value.trim())}
                  placeholder="sha256…"
                />
              )}
            </Field>
          </div>
        )}

        <Field label={tx("releaseNotes")}>
          {(p) => (
            <Textarea {...p} rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={tx("notesPlaceholder")} />
          )}
        </Field>

        <div className="flex items-center gap-3">
          <Button onClick={() => {
              setError(null); // a failed publish must not surface inside the rollback dialog
              setConfirmPublish(true);
            }} disabled={!canSubmit || publish.isPending}>
            {publish.isPending ? <Spinner /> : <Rocket size={16} aria-hidden />} {tx("publish")}
          </Button>
          {!canSubmit && <span className="text-xs text-text-3">{tx("validationHint")}</span>}
        </div>
      </Card>

      <Card className="space-y-3">
        <p className="font-medium text-text-1">{tx("historyHeading")}</p>
        {isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : !data || data.items.length === 0 ? (
          <p className="text-sm text-text-2">{tx("empty")}</p>
        ) : (
          <TableFrame
            head={
              <tr>
                <th className="p-3 text-left">{tx("colPlatform")}</th>
                <th className="p-3 text-left">{tx("colVersion")}</th>
                <th className="p-3 text-left">{tx("colType")}</th>
                <th className="p-3 text-left">{tx("colStatus")}</th>
                <th className="p-3 text-left">{tx("colReleased")}</th>
                <th className="p-3 text-right">{tx("colActions")}</th>
              </tr>
            }
          >
            {data.items.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="p-3">{r.platform}</td>
                <td className="p-3 font-money">
                  {r.version} <span className="text-text-3">({r.versionCode})</span>
                </td>
                <td className="p-3">
                  <Badge tone={typeTone(r.updateType)}>{tx(`type_${r.updateType}`)}</Badge>
                </td>
                <td className="p-3">
                  <Badge tone={r.status === "published" ? "success" : "neutral"}>{tx(`status_${r.status}`)}</Badge>
                </td>
                <td className="p-3 text-text-2">{new Date(r.releasedAt).toLocaleString()}</td>
                <td className="p-3 text-right">
                  {r.status === "published" && (
                    <Button size="sm" variant="secondary" onClick={() => {
                        setError(null);
                        setRollbackId(r.id);
                      }}>
                      <Undo2 size={14} aria-hidden /> {tx("rollback")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </TableFrame>
        )}
      </Card>

      <TotpActionDialog
        open={confirmPublish}
        onClose={() => setConfirmPublish(false)}
        title={tx("confirmPublishTitle")}
        description={tx("confirmPublishBody", { version: version || "—", platform })}
        actionLabel={tx("publish")}
        requireTotp={me?.totpEnabled ?? true}
        busy={publish.isPending}
        error={error}
        onConfirm={({ totpCode }) => void doPublish(totpCode)}
      />

      <TotpActionDialog
        open={rollbackId !== null}
        onClose={() => setRollbackId(null)}
        title={tx("confirmRollbackTitle")}
        description={tx("confirmRollbackBody")}
        actionLabel={tx("rollback")}
        destructive
        reasonLabel={tx("reason")}
        reasonRequired
        requireTotp={me?.totpEnabled ?? true}
        busy={setStatus.isPending}
        error={error}
        onConfirm={({ totpCode, reason }) => {
          if (rollbackId) void doRollback(rollbackId, totpCode, reason ?? "");
        }}
      />
    </div>
  );
}
