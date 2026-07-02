"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Spinner } from "@/components/ui/spinner";
import { useAdminMe, useAdminToken } from "@/hooks/use-admin";

export const dynamic = "force-dynamic";

/**
 * Admin area guard. Admins have no refresh cookie (Documents/10 D20): if the
 * in-memory token is gone, send them to /admin/login. The login route renders
 * outside the shell.
 */
export default function AdminLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  const token = useAdminToken();
  const { data: me, isLoading, isError } = useAdminMe(Boolean(token) && !isLogin);
  const router = useRouter();

  useEffect(() => {
    if (!isLogin && !token) router.replace("/admin/login");
  }, [isLogin, token, router]);

  useEffect(() => {
    if (!isLogin && token && !isLoading && (isError || !me)) router.replace("/admin/login");
  }, [isLogin, token, isLoading, isError, me, router]);

  if (isLogin) return <>{children}</>;

  if (!token || isLoading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-2">
        <Spinner size={24} />
      </div>
    );
  }

  return (
    <AdminShell role={me.role} email={me.email}>
      {children}
    </AdminShell>
  );
}
