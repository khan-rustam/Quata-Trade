import { Wrench } from "lucide-react";
import { Logo } from "@/components/brand/logo";

export const metadata = { title: "Under maintenance — QuataTrade" };

export default function MaintenancePage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo size={22} />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-2 text-accent-400">
        <Wrench size={26} />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">We&rsquo;ll be right back</h1>
        <p className="mx-auto mt-2 max-w-md text-text-2">
          QuataTrade is undergoing scheduled maintenance to keep your trades safe. Your funds are secure. Please check
          back shortly.
        </p>
      </div>
    </main>
  );
}
