import { useState } from 'react';
import { LandPlotIcon, PlusIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { Court } from '@courtly/contracts';
import { useAdminCourts, useUpdateCourt } from '@/api/courts';
import { EmptyState } from '@/components/empty-state';
import { ErrorBanner } from '@/components/error-banner';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { CourtFormDialog } from '@/features/courts/court-form-dialog';
import { DeactivateCourtDialog } from '@/features/courts/deactivate-court-dialog';
import {
  CourtsTable,
  CourtsTableSkeleton,
} from '@/features/courts/courts-table';

function NewCourtButton({ onClick }: { onClick: () => void }) {
  return (
    <Button onClick={onClick}>
      <PlusIcon aria-hidden="true" />
      New court
    </Button>
  );
}

export function AdminCourtsPage() {
  const courts = useAdminCourts();
  const update = useUpdateCourt();
  const [formTarget, setFormTarget] = useState<Court | 'new' | null>(null);
  const [deactivating, setDeactivating] = useState<Court | null>(null);

  // Reactivating needs no confirmation (DESIGN.md section 5).
  function reactivate(court: Court) {
    update.mutate(
      { id: court.id, patch: { isActive: true } },
      {
        onSuccess: () =>
          toast.success('Court reactivated', { description: court.name }),
      },
    );
  }

  function deactivate(court: Court) {
    update.mutate(
      { id: court.id, patch: { isActive: false } },
      {
        onSuccess: () =>
          toast.success('Court deactivated', { description: court.name }),
        // The hook already toasted the failure.
        onSettled: () => setDeactivating(null),
      },
    );
  }

  const reactivatingId =
    update.isPending && update.variables.patch.isActive === true
      ? update.variables.id
      : null;

  const isEmpty = courts.isSuccess && courts.data.length === 0;

  let description = 'Courts you add here can be booked by players.';
  if (courts.isSuccess && !isEmpty) {
    const total = courts.data.length;
    const active = courts.data.filter((court) => court.isActive).length;
    description = `${total} ${total === 1 ? 'court' : 'courts'} · ${active} active. Inactive courts are hidden from players and can’t be booked.`;
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <PageHeader title="Courts" description={description} />
        </div>
        {!isEmpty && <NewCourtButton onClick={() => setFormTarget('new')} />}
      </div>

      <div className="mt-8">
        {courts.isPending && <CourtsTableSkeleton />}

        {courts.isError && (
          <div className="grid gap-4">
            <ErrorBanner
              title="We couldn’t load the courts."
              description="Check your connection and try again."
            />
            <Button
              variant="outline"
              className="w-fit"
              disabled={courts.isFetching}
              onClick={() => void courts.refetch()}
            >
              Try again
            </Button>
          </div>
        )}

        {isEmpty && (
          <EmptyState
            icon={LandPlotIcon}
            title="No courts yet"
            description="Add your first court with its sport, price and opening hours."
          >
            <NewCourtButton onClick={() => setFormTarget('new')} />
          </EmptyState>
        )}

        {courts.isSuccess && !isEmpty && (
          <CourtsTable
            courts={courts.data}
            onEdit={setFormTarget}
            onDeactivate={setDeactivating}
            onReactivate={reactivate}
            reactivatingId={reactivatingId}
          />
        )}
      </div>

      {formTarget && (
        <CourtFormDialog
          court={formTarget === 'new' ? undefined : formTarget}
          onClose={() => setFormTarget(null)}
        />
      )}

      {deactivating && (
        <DeactivateCourtDialog
          courtName={deactivating.name}
          isPending={update.isPending}
          onConfirm={() => deactivate(deactivating)}
          onClose={() => setDeactivating(null)}
        />
      )}
    </>
  );
}
