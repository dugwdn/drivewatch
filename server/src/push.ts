// Sends phone alerts (iPhone and Android) through Expo's free push service.

import type { Env } from './auth';
import type { AlertText } from '../../shared/alerts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function pushToParents(env: Env, familyId: string, alert: AlertText): Promise<number> {
  const { results } = await env.DB.prepare(
    "SELECT push_token FROM members WHERE family_id = ? AND role = 'parent' AND push_token IS NOT NULL",
  )
    .bind(familyId)
    .all<{ push_token: string }>();
  if (!results.length) return 0;

  const messages = results.map((r) => ({
    to: r.push_token,
    title: alert.title,
    body: alert.body,
    sound: 'default',
    priority: 'high',
    interruptionLevel: 'time-sensitive',
    channelId: 'alerts', // Android: the loud channel the app creates
  }));

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(messages),
  });
  if (!res.ok) {
    console.error('push failed', res.status, await res.text());
    return 0;
  }
  return messages.length;
}
