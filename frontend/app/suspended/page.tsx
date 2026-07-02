import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Account suspended — QuataTrade" };

export default function SuspendedPage(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo size={22} />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/15 text-danger">
        <ShieldAlert size={26} />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">Your account is on hold</h1>
        <p className="mx-auto mt-2 max-w-md text-text-2">
          Access to this account is currently restricted. If you believe this is a mistake, contact support and we&rsquo;ll
          review it with you.
        </p>
      </div>
      <Link href="/contact">
        <Button>Contact support</Button>
      </Link>
    </main>
  );
}
