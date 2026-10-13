import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// Same geometry as CourtCard, so nothing jumps when the data arrives.
export function CourtCardSkeleton() {
  return (
    <Card aria-hidden="true">
      <Skeleton className="h-6 w-16 rounded-full" />
      <Skeleton className="mt-4 h-8 w-2/3" />
      <div className="mt-5 grid gap-3 border-t border-line-soft pt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
      <Skeleton className="mt-6 h-10 w-full rounded-full" />
    </Card>
  );
}
