"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  BadgeCheck,
  Coins,
  Monitor,
  RefreshCw,
  Repeat,
  ShieldAlert,
  Star,
  Tags,
} from "lucide-react";
import type { AdminUserDetail } from "@quatatrade/shared";
import { TableFrame } from "@/components/admin/admin-ui";
import { StatTile } from "@/components/ui/stat-tile";
import { CopyButton } from "@/components/ui/copy-button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { Dialog } from "@/components/ui/dialog";
import { OtpInput } from "@/components/ui/otp-input";
import { Segmented } from "@/components/ui/segmented";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { adminApi } from "@/lib/api/admin-client";
import { useAdminUserDetail, useAdminMe } from "@/hooks/use-admin";
import { apiErrorMessage } from "@/lib/api/errors";
import { formatDateTime, formatUsdt, formatXaf } from "@/lib/format";

const STATUS_TONE = { active: "success", frozen: "warning", suspended: "danger", closed: "neutral" } as const;
type Action = "freeze" | "suspend" | "restore";

export default function AdminUserDetailPage(): React.JSX.Element {
  const tx = useTranslations("adminUserDetail");
  const params = useParams();
  const id = String(params.id ?? "");
  const { data, isLoading, refetch, isFetching } = useAdminUserDetail(id);
  const [moderating, setModerating] = useState(false);
  const { data: me } = useAdminMe();

  return (
    <div className="space-y-5">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm text-text-2 hover:text-text-1">
        <ArrowLeft size={15} /> {tx("back")}
      </Link>

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-20 w-full rounded-xl" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      ) : !data ? (
        <Card className="text-center">
          <p className="font-medium">{tx("notFound")}</p>
          <p className="mt-1 text-sm text-text-3">{tx("notFoundBody")}</p>
        </Card>
      ) : (
        <>
          {/* header */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar seed={data.user.id} name={data.user.firstName ?? data.user.email} size={48} />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="font-display text-xl font-semibold">{data.user.email}</h1>
                  <Badge tone={STATUS_TONE[data.user.status]}>{data.user.status}</Badge>
                </div>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-3">
                  <span className="font-mono">{data.user.id}</span>
                  <CopyButton value={data.user.id} />
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => void refetch()} disabled={isFetching}>
                <RefreshCw size={14} className={isFetching ? "animate-spin" : ""} /> {tx("refresh")}
              </Button>
              <Button size="sm" onClick={() => setModerating(true)}>
                {tx("moderate")}
              </Button>
            </div>
          </div>

          {/* stat tiles */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label={tx("statTrades")}
              value={data.stats.tradesTotal}
              footnote={tx("statCompleted", { n: data.stats.tradesCompleted })}
              icon={<Repeat size={16} />}
            />
            <StatTile
              label={tx("statVolume")}
              value={<span className="font-money">{formatXaf(data.stats.volumeCompletedXaf)}</span>}
              footnote="XAF"
              icon={<Coins size={16} />}
            />
            <StatTile
              label={tx("statAvailable")}
              value={<span className="font-money">{formatUsdt(availableUsdt(data), "USDT_TRC20", 2)}</span>}
              footnote="USDT"
              icon={<Coins size={16} />}
            />
            <StatTile
              label={tx("statReputation")}
              value={
                <span className="flex items-center gap-1">
                  <Star size={15} className="text-warning" /> {data.user.reputationScore}
                </span>
              }
              icon={<Star size={16} />}
            />
            <StatTile label={tx("statOffers")} value={`${data.stats.offersActive}/${data.stats.offersTotal}`} icon={<Tags size={16} />} />
            <StatTile label={tx("statDisputes")} value={data.stats.tradesDisputed} footnote={tx("openN", { n: data.stats.openDisputes })} icon={<ShieldAlert size={16} />} />
            <StatTile label={tx("statWithdrawals")} value={data.stats.withdrawalsTotal} icon={<ArrowUpFromLine size={16} />} />
            <StatTile label={tx("statDeposits")} value={data.stats.depositsTotal} icon={<ArrowDownToLine size={16} />} />
          </div>

          {/* profile */}
          <Section title={tx("secProfile")} icon={<BadgeCheck size={16} />}>
            <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Detail label={tx("fName")} value={fullName(data) || "—"} />
              <Detail label={tx("fPhone")} value={data.user.phone ?? "—"} />
              <Detail label={tx("fCountry")} value={data.user.country} />
              <Detail label={tx("fKyc")} value={`T${data.user.kycTier} · ${data.user.kycStatus.toLowerCase()}`} />
              <Detail
                label={tx("fEmailVerified")}
                value={<Badge tone={data.user.emailVerified ? "success" : "warning"}>{data.user.emailVerified ? tx("yes") : tx("no")}</Badge>}
              />
              <Detail
                label={tx("fPhoneVerified")}
                value={<Badge tone={data.user.phoneVerified ? "success" : "neutral"}>{data.user.phoneVerified ? tx("yes") : tx("no")}</Badge>}
              />
              <Detail
                label={tx("fTotp")}
                value={<Badge tone={data.user.totpEnabled ? "success" : "neutral"}>{data.user.totpEnabled ? tx("enabled") : tx("disabled")}</Badge>}
              />
              <Detail label={tx("fJoined")} value={formatDateTime(data.user.createdAt)} />
            </div>
            {data.user.bio && <p className="mt-4 border-t border-border pt-3 text-sm text-text-2">{data.user.bio}</p>}
          </Section>

          {/* balances */}
          <Section title={tx("secBalances")} icon={<Coins size={16} />}>
            {data.balances.length === 0 ? (
              <Empty text={tx("emptyBalances")} />
            ) : (
              <TableFrame
                head={
                  <tr>
                    <th className="px-4 py-2.5">{tx("thAsset")}</th>
                    <th className="px-4 py-2.5">{tx("thKind")}</th>
                    <th className="px-4 py-2.5 text-right">{tx("thBalance")}</th>
                  </tr>
                }
              >
                {data.balances.map((b) => (
                  <tr key={`${b.asset}-${b.kind}`}>
                    <td className="px-4 py-2.5">{b.asset}</td>
                    <td className="px-4 py-2.5 text-text-2">{b.kind.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2.5 text-right font-money tabular-nums">{formatUsdt(b.balance, "USDT_TRC20", 2)}</td>
                  </tr>
                ))}
              </TableFrame>
            )}
          </Section>

          {/* recent trades */}
          <Section title={tx("secTrades")} icon={<Repeat size={16} />}>
            {data.recentTrades.length === 0 ? (
              <Empty text={tx("emptyTrades")} />
            ) : (
              <TableFrame
                head={
                  <tr>
                    <th className="px-4 py-2.5">{tx("thRef")}</th>
                    <th className="px-4 py-2.5">{tx("thSide")}</th>
                    <th className="px-4 py-2.5">{tx("thCounterparty")}</th>
                    <th className="px-4 py-2.5 text-right">{tx("thAmount")}</th>
                    <th className="px-4 py-2.5">{tx("thStatus")}</th>
                    <th className="px-4 py-2.5">{tx("thDate")}</th>
                  </tr>
                }
              >
                {data.recentTrades.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{t.shortRef}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={t.side === "BUY" ? "success" : "danger"}>{tx(`side_${t.side}`)}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-text-2">{t.counterpartyEmail}</td>
                    <td className="px-4 py-2.5 text-right font-money tabular-nums">
                      {formatUsdt(t.amount, "USDT_TRC20", 2)}
                    </td>
                    <td className="px-4 py-2.5"><Badge tone="neutral">{t.status}</Badge></td>
                    <td className="px-4 py-2.5 text-xs text-text-3">{formatDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </TableFrame>
            )}
          </Section>

          {/* withdrawals + deposits */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title={tx("secWithdrawals")} icon={<ArrowUpFromLine size={16} />}>
              {data.recentWithdrawals.length === 0 ? (
                <Empty text={tx("emptyWithdrawals")} />
              ) : (
                <TableFrame
                  head={
                    <tr>
                      <th className="px-4 py-2.5 text-right">{tx("thAmount")}</th>
                      <th className="px-4 py-2.5">{tx("thStatus")}</th>
                      <th className="px-4 py-2.5">{tx("thDate")}</th>
                    </tr>
                  }
                >
                  {data.recentWithdrawals.map((w) => (
                    <tr key={w.id}>
                      <td className="px-4 py-2.5 text-right font-money tabular-nums">{formatUsdt(w.amount, "USDT_TRC20", 2)}</td>
                      <td className="px-4 py-2.5"><Badge tone="neutral">{w.status}</Badge></td>
                      <td className="px-4 py-2.5 text-xs text-text-3">{formatDateTime(w.createdAt)}</td>
                    </tr>
                  ))}
                </TableFrame>
              )}
            </Section>

            <Section title={tx("secDeposits")} icon={<ArrowDownToLine size={16} />}>
              {data.recentDeposits.length === 0 ? (
                <Empty text={tx("emptyDeposits")} />
              ) : (
                <TableFrame
                  head={
                    <tr>
                      <th className="px-4 py-2.5 text-right">{tx("thAmount")}</th>
                      <th className="px-4 py-2.5">{tx("thStatus")}</th>
                      <th className="px-4 py-2.5">{tx("thDate")}</th>
                    </tr>
                  }
                >
                  {data.recentDeposits.map((d) => (
                    <tr key={d.id}>
                      <td className="px-4 py-2.5 text-right font-money tabular-nums">{formatUsdt(d.amount, "USDT_TRC20", 2)}</td>
                      <td className="px-4 py-2.5"><Badge tone="neutral">{d.status}</Badge></td>
                      <td className="px-4 py-2.5 text-xs text-text-3">{formatDateTime(d.createdAt)}</td>
                    </tr>
                  ))}
                </TableFrame>
              )}
            </Section>
          </div>

          {/* kyc submissions */}
          <Section title={tx("secKyc")} icon={<BadgeCheck size={16} />}>
            {data.kyc.length === 0 ? (
              <Empty text={tx("emptyKyc")} />
            ) : (
              <TableFrame
                head={
                  <tr>
                    <th className="px-4 py-2.5">{tx("thTier")}</th>
                    <th className="px-4 py-2.5">{tx("thDoc")}</th>
                    <th className="px-4 py-2.5">{tx("thStatus")}</th>
                    <th className="px-4 py-2.5">{tx("thReviewed")}</th>
                    <th className="px-4 py-2.5">{tx("thDate")}</th>
                  </tr>
                }
              >
                {data.kyc.map((k) => (
                  <tr key={k.id}>
                    <td className="px-4 py-2.5">T{k.tier}</td>
                    <td className="px-4 py-2.5 text-text-2">{k.docType}</td>
                    <td className="px-4 py-2.5"><Badge tone={k.status === "APPROVED" ? "success" : "neutral"}>{k.status}</Badge></td>
                    <td className="px-4 py-2.5 text-xs text-text-3">{k.reviewedAt ? formatDateTime(k.reviewedAt) : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-text-3">{formatDateTime(k.createdAt)}</td>
                  </tr>
                ))}
              </TableFrame>
            )}
          </Section>

          {/* device sessions */}
          <Section title={tx("secSessions")} icon={<Monitor size={16} />}>
            {data.sessions.length === 0 ? (
              <Empty text={tx("emptySessions")} />
            ) : (
              <TableFrame
                head={
                  <tr>
                    <th className="px-4 py-2.5">{tx("thIp")}</th>
                    <th className="px-4 py-2.5">{tx("thDevice")}</th>
                    <th className="px-4 py-2.5">{tx("thStatus")}</th>
                    <th className="px-4 py-2.5">{tx("thDate")}</th>
                  </tr>
                }
              >
                {data.sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2.5 font-mono text-xs">{s.ip ?? "—"}</td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-xs text-text-2">{s.userAgent ?? s.deviceFingerprint ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone={s.revoked ? "neutral" : "success"}>{s.revoked ? tx("revoked") : tx("activeSession")}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-text-3">{formatDateTime(s.createdAt)}</td>
                  </tr>
                ))}
              </TableFrame>
            )}
          </Section>

          {/* risk events */}
          <Section title={tx("secRisk")} icon={<AlertTriangle size={16} />}>
            {data.riskEvents.length === 0 ? (
              <Empty text={tx("emptyRisk")} />
            ) : (
              <TableFrame
                head={
                  <tr>
                    <th className="px-4 py-2.5">{tx("thKind")}</th>
                    <th className="px-4 py-2.5 text-right">{tx("thScore")}</th>
                    <th className="px-4 py-2.5">{tx("thActionTaken")}</th>
                    <th className="px-4 py-2.5">{tx("thDate")}</th>
                  </tr>
                }
              >
                {data.riskEvents.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">{r.kind}</td>
                    <td className="px-4 py-2.5 text-right font-money tabular-nums">{r.score}</td>
                    <td className="px-4 py-2.5 text-text-2">{r.actionTaken ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-text-3">{formatDateTime(r.createdAt)}</td>
                  </tr>
                ))}
              </TableFrame>
            )}
          </Section>

          {moderating && (
            <ModerateDialog
              user={data.user}
              requireTotp={Boolean(me?.totpEnabled)}
              onClose={() => setModerating(false)}
            />
          )}
        </>
      )}
    </div>
  );
}

function availableUsdt(data: AdminUserDetail): string {
  return data.balances.find((b) => b.kind === "user_available" && b.asset === "USDT_TRC20")?.balance ?? "0";
}
function fullName(data: AdminUserDetail): string {
  return [data.user.firstName, data.user.lastName].filter(Boolean).join(" ");
}

function Section({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }): React.JSX.Element {
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2 font-display text-base font-semibold">
        {icon && <span className="text-accent-400">{icon}</span>}
        {title}
      </h2>
      {children}
    </section>
  );
}

function Detail({ label, value }: { label: string; value: ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-2 last:border-0">
      <span className="text-sm text-text-3">{label}</span>
      <span className="text-sm font-medium text-text-1">{value}</span>
    </div>
  );
}

function Empty({ text }: { text: string }): React.JSX.Element {
  return <Card className="text-center text-sm text-text-3">{text}</Card>;
}

function ModerateDialog({
  user,
  requireTotp,
  onClose,
}: {
  user: AdminUserDetail["user"];
  requireTotp: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const tx = useTranslations("adminUserDetail");
  const qc = useQueryClient();
  const toast = useToast();
  const [action, setAction] = useState<Action>(user.status === "active" ? "freeze" : "restore");
  const [reason, setReason] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Step-up: freezing or restoring an account cuts off or restores a user's
  // access to their own funds, so the server re-verifies the admin's own TOTP.
  const totpOk = !requireTotp || totp.length >= 6;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await adminApi.adminModerateUser(user.id, action, { reason, totpCode: totp || undefined });
      toast.success(tx("moderated"), user.email);
      onClose();
      void qc.invalidateQueries({ queryKey: ["admin"] });
    } catch (err) {
      setError(apiErrorMessage(err, tx("actionFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title={tx("dlgTitle")} description={user.email}>
      <div className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}
        <div>
          <p className="mb-1.5 text-sm font-medium">{tx("actionLabel")}</p>
          <Segmented
            value={action}
            onChange={setAction}
            aria-label={tx("actionLabel")}
            className="w-full"
            options={[
              { value: "freeze", label: tx("optFreeze"), tone: "default" },
              { value: "suspend", label: tx("optSuspend"), tone: "danger" },
              { value: "restore", label: tx("optRestore"), tone: "success" },
            ]}
          />
        </div>
        <Field label={tx("reasonLabel")} required>
          {(p) => <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tx("reasonPlaceholder")} {...p} />}
        </Field>
        {requireTotp && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{tx("authenticatorCodeLabel")}</label>
            <OtpInput value={totp} onChange={setTotp} aria-label={tx("authenticatorCodeAria")} invalid={Boolean(error)} />
          </div>
        )}
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose} disabled={busy}>
            {tx("cancel")}
          </Button>
          <Button
            variant={action === "restore" ? "primary" : "danger"}
            className="flex-1"
            onClick={submit}
            disabled={busy || reason.trim().length < 5 || !totpOk}
          >
            {busy ? <Spinner /> : tx("confirm")}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
