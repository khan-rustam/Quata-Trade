"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { useAuthBootstrap, useMe } from "@/hooks/use-auth";

/**
 * Auth guard for the whole app area. Runs a silent refresh, then gates on /me.
 * Unauthenticated users are redirected to /login. Server never trusts client
 * role — the API re-checks every request.
 */
export default function AppLayout({ children }: { children: ReactNode }): React.JSX.Element {
  const ready = useAuthBootstrap();
  const { data: me, isLoading, isError } = useMe(ready);
  const router = useRouter();

  useEffect(() => {
    if (ready && !isLoading && (isError || !me)) {
      router.replace("/login");
    }
  }, [ready, isLoading, isError, me, router]);

  if (!ready || isLoading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-2">
        <Spinner size={24} />
      </div>
    );
  }

  return <AppShell>{children}</AppShell>;
}
