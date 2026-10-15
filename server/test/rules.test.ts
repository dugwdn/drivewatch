import { describe, expect, it } from 'vitest';
import { isDailyRun, isSampleFamily } from '../src/index';

describe('sample family lock', () => {
  it('treats only demo- families as the sample family', () => {
    expect(isSampleFamily('demo-family')).toBe(true);
    expect(isSampleFamily('5f2c1a7e-1d2b-4c3d-9e8f-0a1b2c3d4e5f')).toBe(false);
  });
});

describe('daily route cleanup', () => {
  it('runs on the 07:00 UTC cron tick only', () => {
    expect(isDailyRun(Date.UTC(2026, 9, 1, 7, 0))).toBe(true);
    expect(isDailyRun(Date.UTC(2026, 9, 1, 7, 4, 59))).toBe(true);
    expect(isDailyRun(Date.UTC(2026, 9, 1, 7, 5))).toBe(false);
    expect(isDailyRun(Date.UTC(2026, 9, 1, 19, 0))).toBe(false);
  });
});
