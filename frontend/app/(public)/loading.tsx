import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a public/marketing route loads. */
export default function PublicLoading(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-16 md:px-6">
      <Skeleton className="h-10 w-2/3 rounded-lg" />
      <Skeleton className="h-5 w-full rounded" />
      <Skeleton className="h-5 w-5/6 rounded" />
      <div className="grid gap-4 pt-4 sm:grid-cols-2">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
