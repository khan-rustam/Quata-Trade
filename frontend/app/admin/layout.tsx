"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { Spinner } from "@/components/ui/spinner";
import { restoreAdminSession } from "@/lib/api/admin-client";
import { useAdminMe, useAdminToken } from "@/hooks/use-admin";

export const dynamic = "force-dynamic";

/**
 * Admin area guard.
 *
 * The access token lives in memory, so it is always gone after a page load.
 * Before concluding "not signed in", this asks the server to trade the
 * httpOnly refresh cookie for a fresh one. That single call is what makes a
 * session survive a refresh, a new tab and a closed laptop — without any
 * token ever being written somewhere script can read it.
 *
 * The restore MUST complete before the redirect decision. Redirecting on a
 * missing in-memory token alone would bounce every signed-in admin to the
 * login screen on every refresh, which is the bug this whole change exists to
 * remove.
 */
export default function AdminLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const pathname = usePathname();
  const isLogin = pathname === "/admin/login";
  const token = useAdminToken();
  const router = useRouter();

  // null = the restore attempt has not finished yet.
  const [restoreDone, setRestoreDone] = useState<boolean | null>(null);

  useEffect(() => {
    // The login page must not attempt a restore: an admin who just clicked
    // "log out" would be silently signed back in by their own cookie. Handled
    // by NOT running the effect rather than by setting state inside it —
    // a synchronous setState in an effect body causes a cascading render.
    if (isLogin) return;
    let cancelled = false;
    void restoreAdminSession().then((ok) => {
      if (!cancelled) setRestoreDone(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [isLogin]);

  // On the login route there is nothing to wait for, so it is ready by
  // definition — derived, not stored.
  const ready = isLogin || restoreDone !== null;
  const { data: me, isLoading, isError } = useAdminMe(Boolean(token) && !isLogin && ready);

  useEffect(() => {
    // Only redirect once the restore has actually been tried and failed.
    if (!isLogin && ready && !token) router.replace("/admin/login");
  }, [isLogin, ready, token, router]);

  useEffect(() => {
    if (!isLogin && token && ready && !isLoading && (isError || !me)) {
      router.replace("/admin/login");
    }
  }, [isLogin, token, ready, isLoading, isError, me, router]);

  if (isLogin) return <>{children}</>;

  if (!ready || !token || isLoading || !me) {
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
