import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';

// Services read "now" from here, so tests can replace it with a fixed instant.
export abstract class Clock {
  abstract now(): DateTime;
}

// The only place in src/ that reads real time. Always UTC: converting to the
// facility zone is the caller's decision, made with the configured zone.
@Injectable()
export class SystemClock extends Clock {
  now(): DateTime {
    return DateTime.now().toUTC();
  }
}
