import type { Court } from '@courtly/contracts';
import { minutesToTime } from '../common/time/facility-time';
import type { Court as CourtRow } from '../generated/prisma/client';

// Builds the contract's keys one by one instead of spreading the row, so a
// column added to the table later does not reach the response by accident.
export function toCourt(row: CourtRow): Court {
  return {
    id: row.id,
    name: row.name,
    sportType: row.sportType,
    pricePerHourCents: row.pricePerHourCents,
    opensAt: minutesToTime(row.opensAtMinutes),
    closesAt: minutesToTime(row.closesAtMinutes),
    isActive: row.isActive,
  };
}
