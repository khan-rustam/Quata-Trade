"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Banknote,
  Bell,
  ChevronRight,
  FileText,
  LogOut,
  ShieldCheck,
  Tags,
  User,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ComponentType } from "react";
import { useTranslations } from "next-intl";
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
  const tx = useTranslations("account");

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <PageHeader title={tx("title")} />

      <Card className="flex items-center gap-4">
        {me ? (
          <Avatar seed={me.avatarSeed ?? me.id} style={me.avatarStyle} name={me.firstName ?? me.email} size={56} />
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
                    {tx("tier")} {me.kycTier} · {tx(`status_${me.kycStatus}`)}
                  </Badge>
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <div className="overflow-hidden rounded-xl border border-border">
        <MenuLink href="/account/offers" icon={Tags} label={tx("myOffers")} />
        <MenuLink href="/account/payment-methods" icon={Banknote} label={tx("paymentMethods")} />
        <MenuLink href="/account/kyc" icon={BadgeCheck} label={tx("kyc")} />
        <MenuLink href="/account/security" icon={ShieldCheck} label={tx("security")} />
        <MenuLink href="/account/notifications" icon={Bell} label={tx("notifications")} />
        <MenuLink href="/account/profile" icon={User} label={tx("profile")} />
        <MenuLink href="/legal/terms" icon={FileText} label={tx("terms")} />
      </div>

      <button
        type="button"
        onClick={() => logout.mutate(undefined, { onSettled: () => router.replace("/login") })}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border py-3 text-sm font-medium text-danger transition-colors hover:bg-surface-2"
      >
        <LogOut size={16} /> {tx("logout")}
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
