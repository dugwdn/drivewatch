// Decides which events become a push alert to parents, and the words.
// The server runs this so a family's rules are checked in one place.

import type { EventType, FamilyRules } from './types';
import { mph } from './types';

export interface AlertEvent {
  type: EventType;
  speedMps: number | null;
  detail?: Record<string, unknown>;
}

export interface AlertText {
  title: string;
  body: string;
}

export function alertFor(
  event: AlertEvent,
  rules: FamilyRules,
  driverName: string,
): AlertText | null {
  const speed = Math.round(mph(event.speedMps));
  const phoneRule = speed >= rules.phoneSpeedMph;

  switch (event.type) {
    case 'phone_unlocked':
      return phoneRule
        ? { title: 'Phone use while driving', body: `${driverName}'s phone was unlocked at ${speed} mph.` }
        : null;
    case 'phone_handling':
      return phoneRule
        ? { title: 'Phone use while driving', body: `${driverName}'s phone was picked up at ${speed} mph.` }
        : null;
    case 'handheld_call':
      return phoneRule
        ? { title: 'Handheld call while driving', body: `${driverName} was on a call held to the ear at ${speed} mph.` }
        : null;
    case 'over_speed':
      return speed >= rules.maxSpeedMph
        ? { title: 'High speed', body: `${driverName} reached ${speed} mph.` }
        : null;
    case 'permission_changed': {
      const to = String(event.detail?.permission ?? 'off');
      return {
        title: 'Tracking changed',
        body: `DriveWatch location on ${driverName}'s phone is now "${permissionLabel(to)}". Drives won't be tracked until it's set back to "Always".`,
      };
    }
    case 'signal_lost':
      return {
        title: 'Phone stopped reporting',
        body: `${driverName}'s phone stopped reporting in the middle of a drive.`,
      };
    default:
      return null;
  }
}

function permissionLabel(p: string): string {
  if (p === 'when_in_use') return 'While Using the App';
  if (p === 'denied') return 'Never';
  if (p === 'always') return 'Always';
  return 'Off';
}
