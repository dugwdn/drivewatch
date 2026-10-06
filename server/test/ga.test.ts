import { describe, expect, it } from 'vitest';
import { gaClientId, gaMeasurementId, gaPayloads, gaScreenName, gaWebTag } from '../../shared/ga';
import type { UsageIn } from '../../shared/usage';
import type { Env } from '../src/auth';
import { sendScreensToGa } from '../src/index';
import { page } from '../src/pages';

const CID = '3f2a9c1e-55aa-4b1e-9c33-0a1b2c3d4e5f';
const env = (extra: Partial<Env> = {}) => ({ DB: {} as D1Database, ...extra }) as Env;
const rows: UsageIn[] = [
  { id: 'aaaaaaaa-1', action: 'app_open', object: null, t: 1 },
  { id: 'aaaaaaaa-2', action: 'screen_view', object: 'parent/trip/[id]', t: 2 },
  { id: 'aaaaaaaa-3', action: 'screen_view', object: 'driver', t: 3 },
];

describe('GA4 web tag on the public pages', () => {
  it('is not loaded at all while GA4_ID is empty or a placeholder', async () => {
    for (const id of [undefined, '', 'G-XXXXXXXXXX', 'UA-123-1', 'G-ABC"><script>']) {
      expect(gaMeasurementId(id)).toBeNull();
      for (const path of ['', '/privacy', '/support']) {
        expect(await page(path, env({ GA4_ID: id })).text()).not.toContain('googletagmanager');
      }
    }
  });

  it('with an id: the tag with ad signals off, ad storage denied, and no query string', async () => {
    const html = await page('/privacy', env({ GA4_ID: 'G-ABC123XYZ9' })).text();
    expect(html).toContain('https://www.googletagmanager.com/gtag/js?id=G-ABC123XYZ9');
    expect(html).toContain('allow_google_signals:false,allow_ad_personalization_signals:false');
    expect(html).toContain('ad_storage:"denied",ad_user_data:"denied",ad_personalization:"denied",analytics_storage:"granted"');
    expect(html).toContain('page_location:location.origin+location.pathname');
    expect(gaWebTag('')).toBe('');
  });

  it('the privacy page names Google Analytics and what it never gets', async () => {
    const html = await page('/privacy', env()).text();
    expect(html).toContain('Google Analytics counts anonymous visits');
    expect(html).toContain('never gets location, speed, drives, phone-use alerts, names');
  });
});

describe('app screen counts to the Measurement Protocol', () => {
  it('sends screen names only, ids as :id, with the install id', () => {
    expect(gaScreenName('parent/trip/[id]')).toBe('parent/trip/:id');
    expect(gaScreenName('parent/trip/5f2c 41.1,-81.4')).toBeNull();
    expect(gaPayloads(rows, CID)).toEqual([
      {
        client_id: CID,
        non_personalized_ads: true,
        events: [
          { name: 'screen_view', params: { screen_name: 'parent/trip/:id', engagement_time_msec: 1 } },
          { name: 'screen_view', params: { screen_name: 'driver', engagement_time_msec: 1 } },
        ],
      },
    ]);
  });

  it('accepts only a random UUID as the client id', () => {
    expect(gaClientId(CID)).toBe(CID);
    expect(gaClientId('member-123')).toBeNull();
    expect(gaClientId(undefined)).toBeNull();
  });

  it('sends nothing unless GA4_ID, GA4_API_SECRET and an install id are all there', async () => {
    const calls: { url: string; body: string }[] = [];
    const fake = (async (url: string, init: RequestInit) => {
      calls.push({ url, body: String(init.body) });
      return new Response(null, { status: 204 });
    }) as unknown as typeof fetch;
    expect(await sendScreensToGa(env({ GA4_ID: '', GA4_API_SECRET: 's' }), rows, CID, fake)).toBe(0);
    expect(await sendScreensToGa(env({ GA4_ID: 'G-ABC123XYZ9' }), rows, CID, fake)).toBe(0);
    expect(await sendScreensToGa(env({ GA4_ID: 'G-ABC123XYZ9', GA4_API_SECRET: 's' }), rows, 'not-a-uuid', fake)).toBe(0);
    expect(calls).toHaveLength(0);

    expect(await sendScreensToGa(env({ GA4_ID: 'G-ABC123XYZ9', GA4_API_SECRET: 's3cret' }), rows, CID, fake)).toBe(2);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe('https://www.google-analytics.com/mp/collect?measurement_id=G-ABC123XYZ9&api_secret=s3cret');
    const body = JSON.parse(calls[0].body);
    expect(Object.keys(body).sort()).toEqual(['client_id', 'events', 'non_personalized_ads']);
    expect(calls[0].body).not.toMatch(/"(user_id|user_location|lat|lon|speed|trip_id|family_id|member_id|ip_override)"/);
  });

  it('a Google failure is swallowed', async () => {
    const boom = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    expect(await sendScreensToGa(env({ GA4_ID: 'G-ABC123XYZ9', GA4_API_SECRET: 's' }), rows, CID, boom)).toBe(0);
  });
});
