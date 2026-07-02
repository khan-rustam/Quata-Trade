"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bell,
  ChevronRight,
  FileText,
  LogOut,
  ShieldCheck,
  User,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { useMe, useLogout } from "@/hooks/use-auth";

const KYC_TONE = {
  APPROVED: "success",
  PENDING: "warning",
  REJECTED: "danger",
  RESUBMIT: "warning",
  NONE: "neutral",
} as const;

export default function AccountPage(): React.JSX.Element {
  const { data: me, isLoading } = useMe();
  const logout = useLogout();
  const router = useRouter();

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title="Account" />

      <Card className="flex items-center gap-4">
        {me ? (
          <Avatar seed={me.id} name={me.firstName ?? me.email} size={56} />
        ) : (
          <Skeleton className="h-14 w-14 rounded-full" />
        )}
        <div className="min-w-0">
          {isLoading ? (
            <Skeleton className="h-5 w-40" />
          ) : (
            <>
              <p className="truncate font-medium">
                {me?.firstName ? `${me.firstName} ${me.lastName ?? ""}`.trim() : me?.email}
              </p>
              <p className="truncate text-sm text-text-3">{me?.email}</p>
              {me && (
                <div className="mt-1.5 flex items-center gap-2">
                  <Badge tone={KYC_TONE[me.kycStatus]} icon={<ShieldCheck size={12} />}>
                    Tier {me.kycTier} · {me.kycStatus === "APPROVED" ? "Verified" : me.kycStatus.toLowerCase()}
                  </Badge>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <div className="overflow-hidden rounded-xl border border-border">
        <MenuLink href="/account/kyc" icon={BadgeCheck} label="Verification & KYC" />
        <MenuLink href="/account/security" icon={ShieldCheck} label="Security center" />
        <MenuLink href="/account/notifications" icon={Bell} label="Notifications" />
        <MenuLink href="/account/profile" icon={User} label="Profile details" />
        <MenuLink href="/legal/terms" icon={FileText} label="Terms & policies" />
      </div>

      <button
        type="button"
        onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login") })}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-danger transition-colors hover:bg-surface-2"
      >
        <LogOut size={16} /> Log out
      </button>
    </div>
  );
}

function MenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: ComponentType<LucideProps>;
  label: string;
}): React.JSX.Element {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 border-b border-border bg-surface-1 px-4 py-3.5 text-sm transition-colors last:border-0 hover:bg-surface-2"
    >
      <Icon size={18} className="text-text-2" />
      <span className="flex-1 font-medium text-text-1">{label}</span>
      <ChevronRight size={16} className="text-text-3" />
    </Link>
  );
}
