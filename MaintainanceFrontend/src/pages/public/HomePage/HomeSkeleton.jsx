import { Skeleton } from '@/components/ui/skeleton';

/** The shape the page will take, held while `useGetHomeQuery` is in flight. */
export function HomeSkeleton() {
  return (
    <div className="container py-10">
      <Skeleton className="h-10 w-2/3 max-w-lg" />
      <Skeleton className="mt-4 h-12 w-full max-w-2xl rounded-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
    </div>
  );
}
