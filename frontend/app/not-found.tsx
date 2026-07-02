import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Keyhole } from "@/components/brand/keyhole";

export default function NotFound(): React.JSX.Element {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <Keyhole size={48} className="text-accent-400" />
      <div>
        <h1 className="font-display text-3xl font-bold">Page not found</h1>
        <p className="mt-2 text-text-2">
          The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
        </p>
      </div>
      <Link href="/">
        <Button>Back to home</Button>
      </Link>
    </main>
  );
}
