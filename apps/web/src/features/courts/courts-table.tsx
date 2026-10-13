import { PencilIcon, PowerIcon, RotateCcwIcon } from 'lucide-react';
import type { Court } from '@courtly/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/format';
import { SPORT_LABELS } from './sport';

type Actions = {
  onEdit: (court: Court) => void;
  onDeactivate: (court: Court) => void;
  onReactivate: (court: Court) => void;
  // The court whose reactivation is in flight, so its button cannot be hit twice.
  reactivatingId: string | null;
};

function StatusBadge({ court }: { court: Court }) {
  return (
    <Badge variant={court.isActive ? 'default' : 'secondary'}>
      {court.isActive ? 'Active' : 'Inactive'}
    </Badge>
  );
}

function RowActions({
  court,
  onEdit,
  onDeactivate,
  onReactivate,
  reactivatingId,
  className,
}: Actions & { court: Court; className: string }) {
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={`Edit ${court.name}`}
        onClick={() => onEdit(court)}
      >
        <PencilIcon aria-hidden="true" />
        Edit
      </Button>
      {court.isActive ? (
        <Button
          variant="destructive-ghost"
          size="sm"
          className="gap-1.5"
          aria-label={`Deactivate ${court.name}`}
          onClick={() => onDeactivate(court)}
        >
          <PowerIcon aria-hidden="true" />
          Deactivate
        </Button>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Reactivate ${court.name}`}
          disabled={reactivatingId === court.id}
          onClick={() => onReactivate(court)}
        >
          <RotateCcwIcon aria-hidden="true" />
          Reactivate
        </Button>
      )}
    </div>
  );
}

// A table from md up, stacked cards below (DESIGN.md section 3). Both are in
// the DOM; CSS hides one, and a hidden element is out of the accessibility
// tree, so a screen reader meets each court once.
export function CourtsTable({
  courts,
  ...actions
}: Actions & { courts: Court[] }) {
  return (
    <>
      <div className="hidden overflow-clip rounded-xl border border-border bg-card md:block">
        <Table>
          <thead>
            <tr className="border-b border-border text-left">
              <TableHead scope="col">Name</TableHead>
              <TableHead scope="col">Sport</TableHead>
              <TableHead scope="col">Price / hour</TableHead>
              <TableHead scope="col">Opening hours</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            </tr>
          </thead>
          <TableBody>
            {courts.map((court) => (
              <tr key={court.id}>
                <TableCell>
                  <span
                    className={cn(
                      'font-serif text-base font-medium',
                      !court.isActive && 'text-muted-foreground',
                    )}
                  >
                    {court.name}
                  </span>
                </TableCell>
                <TableCell>{SPORT_LABELS[court.sportType]}</TableCell>
                <TableCell>{formatPrice(court.pricePerHourCents)}</TableCell>
                <TableCell>
                  {court.opensAt}–{court.closesAt}
                </TableCell>
                <TableCell>
                  <StatusBadge court={court} />
                </TableCell>
                <TableCell className="text-right">
                  <RowActions
                    court={court}
                    className="justify-end"
                    {...actions}
                  />
                </TableCell>
              </tr>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {courts.map((court) => (
          <Card asChild key={court.id} className="p-5">
            <li>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p
                    className={cn(
                      'font-serif text-lg font-medium',
                      !court.isActive && 'text-muted-foreground',
                    )}
                  >
                    {court.name}
                  </p>
                  <p className="mt-0.5 text-sm text-muted-foreground tabular-nums">
                    {SPORT_LABELS[court.sportType]} ·{' '}
                    {formatPrice(court.pricePerHourCents)} per hour ·{' '}
                    {court.opensAt}–{court.closesAt}
                  </p>
                </div>
                <StatusBadge court={court} />
              </div>
              <div className="mt-4 border-t border-line-soft pt-3">
                <RowActions
                  court={court}
                  className="-ml-3 justify-start"
                  {...actions}
                />
              </div>
            </li>
          </Card>
        ))}
      </ul>
    </>
  );
}

// Same geometry as the rows above.
export function CourtsTableSkeleton() {
  return (
    <div aria-busy="true">
      <div
        className="hidden divide-y divide-line-soft overflow-clip rounded-xl border border-border bg-card md:block"
        aria-hidden="true"
      >
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center gap-6 px-5 py-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="ml-auto h-9 w-40 rounded-full" />
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-3 md:hidden" aria-hidden="true">
        {[0, 1, 2, 3].map((row) => (
          <Card asChild key={row} className="p-5">
            <li>
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-2 h-4 w-3/4" />
              <Skeleton className="mt-4 h-9 w-full rounded-full" />
            </li>
          </Card>
        ))}
      </ul>
      <span className="sr-only">Loading courts</span>
    </div>
  );
}
