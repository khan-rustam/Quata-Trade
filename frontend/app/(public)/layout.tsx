import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

/** Marketing + legal shell: header + footer on every public page (Documents/14). */
export default function PublicLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col">
      <PublicHeader />
      <Breadcrumbs contained />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
