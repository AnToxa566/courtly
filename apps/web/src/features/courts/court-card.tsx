import { Link } from 'react-router';
import { ArrowRightIcon } from 'lucide-react';
import type { Court } from '@courtly/contracts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatPrice } from '@/lib/format';
import { SPORT_LABELS } from './sport';

// Only the button is a link, so the focus order stays one stop per court.
export function CourtCard({ court }: { court: Court }) {
  return (
    <Card asChild className="flex flex-col">
      <article>
        <div>
          <Badge variant="outline">{SPORT_LABELS[court.sportType]}</Badge>
        </div>
        <h2 className="mt-4 font-serif text-2xl font-medium">{court.name}</h2>
        <dl className="mt-5 grid gap-2.5 border-t border-line-soft pt-4 text-sm tabular-nums">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Price</dt>
            <dd className="font-medium">
              {formatPrice(court.pricePerHourCents)} per hour
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Open</dt>
            <dd className="font-medium">
              {court.opensAt}–{court.closesAt}
            </dd>
          </div>
        </dl>
        <Button asChild variant="outline" className="mt-6 w-full">
          <Link to={`/courts/${court.id}`}>
            View availability
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </Button>
      </article>
    </Card>
  );
}
