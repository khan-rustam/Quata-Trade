import type { ReactNode } from "react";
import { PublicHeader } from "@/components/public/public-header";
import { PublicFooter } from "@/components/public/public-footer";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

/** Marketing + legal shell: header + footer on every public page (Documents/14). */
export default function PublicLayout({ children }: { children: ReactNode }): React.JSX.Element {
  return (
    <div className="flex min-h-screen flex-col relative overflow-hidden bg-bg">
      {/* Dynamic Background Grid & Ambient Glow across all public routes */}
      <div className="absolute inset-0 -z-25 bg-grid-pattern opacity-20 pointer-events-none" />
      <div 
        className="absolute top-[-100px] left-[15%] -z-20 h-[500px] w-[500px] rounded-full bg-accent-400/5 blur-[120px] pointer-events-none" 
        aria-hidden 
      />
      <div 
        className="absolute bottom-[200px] right-[10%] -z-20 h-[600px] w-[600px] rounded-full bg-brand-700/5 blur-[150px] pointer-events-none" 
        aria-hidden 
      />

      <PublicHeader />
      <Breadcrumbs contained />
      <main id="main-content" className="flex-1 relative z-10">
        {children}
      </main>
      <PublicFooter />
    </div>
  );
}
