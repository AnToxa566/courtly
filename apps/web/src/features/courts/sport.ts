import type { SportType } from '@courtly/contracts';

// Record<SportType, string> makes the build fail when a sport is added to the
// contracts and not here.
export const SPORT_LABELS: Record<SportType, string> = {
  PADEL: 'Padel',
  TENNIS: 'Tennis',
  SQUASH: 'Squash',
  BADMINTON: 'Badminton',
};
