import { describe, expect, it } from 'vitest';
import { cleanUsage, MAX_USAGE_PER_CALL } from '../../shared/usage';

const NOW = 1_800_000_000_000;

describe('usage rows from the phone', () => {
  it('keeps app opens and screen views', () => {
    const rows = cleanUsage(
      [
        { id: 'aaaaaaaa-1', action: 'app_open', t: NOW - 1000 },
        { id: 'aaaaaaaa-2', action: 'screen_view', object: 'parent/trip/[id]', t: NOW },
      ],
      NOW,
    );
    expect(rows).toEqual([
      { id: 'aaaaaaaa-1', action: 'app_open', object: null, t: NOW - 1000 },
      { id: 'aaaaaaaa-2', action: 'screen_view', object: 'parent/trip/[id]', t: NOW },
    ]);
  });

  it('drops server-only actions, bad screens, and odd times', () => {
    const rows = cleanUsage(
      [
        { id: 'aaaaaaaa-1', action: 'family_created', t: NOW },
        { id: 'aaaaaaaa-2', action: 'screen_view', object: 'parent/trip/5f2c-uuid 41.1,-81.4', t: NOW },
        { id: 'aaaaaaaa-3', action: 'app_open', t: NOW - 30 * 24 * 60 * 60 * 1000 },
        { id: 'aaaaaaaa-4', action: 'app_open', t: NOW + 60 * 60 * 1000 },
        { id: 'x', action: 'app_open', t: NOW },
        'junk',
      ],
      NOW,
    );
    expect(rows).toEqual([]);
  });

  it('caps one call', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ id: `aaaaaaaa-${i}`, action: 'app_open', t: NOW }));
    expect(cleanUsage(many, NOW)).toHaveLength(MAX_USAGE_PER_CALL);
    expect(cleanUsage(undefined, NOW)).toEqual([]);
  });
});
