import { Injectable } from '@nestjs/common';
import {
  type Court,
  type CreateCourtRequest,
  type UpdateCourtRequest,
} from '@courtly/contracts';
import { ApiException } from '../common/errors/api.exception';
import { timeToMinutes } from '../common/time/facility-time';
import { PrismaService } from '../prisma/prisma.service';
import { toCourt } from './court.mapper';

// Repeats the message of the contract's order check, so a rejected merge looks
// the same to the client as a rejected create. The e2e suite compares the two.
const CLOSES_AFTER_OPENS = 'closesAt must be after opensAt';

@Injectable()
export class CourtsService {
  constructor(private readonly prisma: PrismaService) {}

  async listActive(): Promise<Court[]> {
    const rows = await this.prisma.court.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
    return rows.map(toCourt);
  }

  // An inactive court is a 404 for users, the same as one that never existed.
  async findActive(id: string): Promise<Court> {
    const row = await this.prisma.court.findFirst({
      where: { id, isActive: true },
    });
    if (!row) {
      throw new ApiException('NOT_FOUND', 'Court not found');
    }
    return toCourt(row);
  }

  async listAll(): Promise<Court[]> {
    const rows = await this.prisma.court.findMany({
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toCourt);
  }

  async create(input: CreateCourtRequest): Promise<Court> {
    const row = await this.prisma.court.create({
      data: {
        name: input.name,
        sportType: input.sportType,
        pricePerHourCents: input.pricePerHourCents,
        opensAtMinutes: timeToMinutes(input.opensAt),
        closesAtMinutes: timeToMinutes(input.closesAt),
      },
    });
    return toCourt(row);
  }

  async update(id: string, patch: UpdateCourtRequest): Promise<Court> {
    const current = await this.prisma.court.findUnique({ where: { id } });
    if (!current) {
      throw new ApiException('NOT_FOUND', 'Court not found');
    }

    // The contract can compare the two times only when the request carries
    // both. Here the patch is merged with the stored court first.
    const opens =
      patch.opensAt === undefined
        ? current.opensAtMinutes
        : timeToMinutes(patch.opensAt);
    const closes =
      patch.closesAt === undefined
        ? current.closesAtMinutes
        : timeToMinutes(patch.closesAt);
    if (opens >= closes) {
      throw new ApiException('VALIDATION_FAILED', 'The request is not valid', [
        { path: 'closesAt', message: CLOSES_AFTER_OPENS },
      ]);
    }

    const row = await this.prisma.court.update({
      where: { id },
      data: {
        name: patch.name,
        sportType: patch.sportType,
        pricePerHourCents: patch.pricePerHourCents,
        isActive: patch.isActive,
        opensAtMinutes: patch.opensAt === undefined ? undefined : opens,
        closesAtMinutes: patch.closesAt === undefined ? undefined : closes,
      },
    });
    return toCourt(row);
  }
}
