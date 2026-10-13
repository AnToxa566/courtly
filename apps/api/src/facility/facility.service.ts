import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Facility } from '@courtly/contracts';
import { Clock } from '../common/time/clock';
import { facilityToday } from '../common/time/facility-time';
import type { Env } from '../config/env';
import { CANCELLATION_WINDOW_HOURS, MAX_BOOKING_HOURS } from './booking-policy';

@Injectable()
export class FacilityService {
  constructor(
    private readonly clock: Clock,
    private readonly config: ConfigService<Env, true>,
  ) {}

  getFacility(): Facility {
    const timezone = this.config.get('FACILITY_TIMEZONE', { infer: true });
    return {
      timezone,
      today: facilityToday(this.clock.now(), timezone),
      cancellationWindowHours: CANCELLATION_WINDOW_HOURS,
      maxBookingHours: MAX_BOOKING_HOURS,
    };
  }
}
