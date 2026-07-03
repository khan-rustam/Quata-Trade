import { Skeleton } from "@/components/ui/skeleton";

/** Shown while an admin route loads. Mirrors the common title + stat-row + table layout. */
export default function AdminLoading(): React.JSX.Element {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-56 rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
