import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { buttonClassName } from "@/components/ui/button";

export const metadata = { title: "Account suspended — QuataTrade" };

export default async function SuspendedPage(): Promise<React.JSX.Element> {
  const t = await getTranslations("statusPages");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5 px-6 text-center">
      <Logo size={22} />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger/15 text-danger">
        <ShieldAlert size={26} />
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold">{t("suspendedTitle")}</h1>
        <p className="mx-auto mt-2 max-w-md text-text-2">
          {t("suspendedBody")}
        </p>
      </div>
      <Link href="/contact" className={buttonClassName()}>
        {t("contactSupport")}
      </Link>
    </main>
  );
}
