import { Skeleton } from "@/components/ui/skeleton";

/** Shown while an authenticated app route loads. */
export default function AppLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-6">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
    </div>
  );
}
