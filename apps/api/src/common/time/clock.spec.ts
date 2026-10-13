import { SystemClock } from './clock';

describe('SystemClock', () => {
  it('returns the current instant in UTC', () => {
    expect(new SystemClock().now().zoneName).toBe('UTC');
  });
});
