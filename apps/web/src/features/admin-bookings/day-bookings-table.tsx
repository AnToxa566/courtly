import type { AdminBooking, AdminDay } from '@courtly/contracts';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead } from '@/components/ui/table';
import { STATUS_BADGE } from '@/features/my-bookings/my-bookings';
import { formatPrice } from '@/lib/format';
import { cn } from '@/lib/utils';

// A cancelled booking keeps its row with the time, court and price struck
// through. The player is muted but not struck: they still booked it.
function struck(booking: AdminBooking) {
  return booking.status === 'cancelled'
    ? 'text-muted-foreground line-through'
    : undefined;
}

function StatusBadge({ booking }: { booking: AdminBooking }) {
  const { label, variant } = STATUS_BADGE[booking.status];
  return <Badge variant={variant}>{label}</Badge>;
}

// A table from md up, stacked cards below (DESIGN.md section 3). Both are in
// the DOM; CSS hides one, so a screen reader meets each booking once. Rows
// are in the order the API sends them (D-096).
export function DayBookingsTable({ day }: { day: AdminDay }) {
  return (
    <>
      <div className="hidden overflow-clip rounded-xl border border-border bg-card md:block">
        <Table>
          <thead>
            <tr className="border-b border-border text-left">
              <TableHead scope="col">Time</TableHead>
              <TableHead scope="col">Court</TableHead>
              <TableHead scope="col">Player</TableHead>
              <TableHead scope="col" className="text-right">
                Price
              </TableHead>
              <TableHead scope="col">Status</TableHead>
            </tr>
          </thead>
          <TableBody>
            {day.bookings.map((booking) => (
              <tr key={booking.id}>
                <TableCell>
                  <span className={cn('font-medium', struck(booking))}>
                    {booking.startTime}–{booking.endTime}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'font-serif text-base font-medium',
                      struck(booking),
                    )}
                  >
                    {booking.court.name}
                  </span>
                </TableCell>
                <TableCell>
                  <p
                    className={cn(
                      booking.status === 'cancelled' && 'text-muted-foreground',
                    )}
                  >
                    {booking.user.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {booking.user.email}
                  </p>
                </TableCell>
                <TableCell className="text-right">
                  <span className={struck(booking)}>
                    {formatPrice(booking.totalPriceCents)}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge booking={booking} />
                </TableCell>
              </tr>
            ))}
          </TableBody>
          <tfoot>
            <tr className="border-t border-border">
              <th
                scope="row"
                colSpan={3}
                className="h-11 px-5 text-left font-medium text-muted-foreground"
              >
                Expected revenue, excluding cancelled
              </th>
              <td className="px-5 text-right font-semibold">
                {formatPrice(day.totalRevenueCents)}
              </td>
              <td />
            </tr>
          </tfoot>
        </Table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden">
        {day.bookings.map((booking) => (
          <Card asChild key={booking.id} className="p-5">
            <li>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm font-medium tabular-nums',
                      struck(booking),
                    )}
                  >
                    {booking.startTime}–{booking.endTime}
                  </p>
                  <p
                    className={cn(
                      'mt-0.5 font-serif text-lg font-medium',
                      struck(booking),
                    )}
                  >
                    {booking.court.name}
                  </p>
                </div>
                <StatusBadge booking={booking} />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-line-soft pt-4">
                <p
                  className={cn(
                    'min-w-0 truncate text-sm',
                    booking.status === 'cancelled' && 'text-muted-foreground',
                  )}
                >
                  {booking.user.name}{' '}
                  <span className="text-xs text-muted-foreground">
                    {booking.user.email}
                  </span>
                </p>
                <span
                  className={cn(
                    'shrink-0 font-medium tabular-nums',
                    struck(booking),
                  )}
                >
                  {formatPrice(booking.totalPriceCents)}
                </span>
              </div>
            </li>
          </Card>
        ))}
      </ul>
    </>
  );
}

export function DayBookingsSkeleton() {
  return (
    <div className="flex flex-col gap-2" aria-busy="true">
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} className="h-11 w-full rounded-lg" />
      ))}
      <span className="sr-only">Loading bookings</span>
    </div>
  );
}
