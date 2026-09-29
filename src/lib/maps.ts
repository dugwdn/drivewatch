import { Linking, Platform } from 'react-native';

/** Maps inside the app use Apple Maps on iPhone. Android would need a paid-
 *  account Google Maps key, so Android opens the Google Maps app instead. */
export const inAppMaps = Platform.OS === 'ios';

export function openInMaps(lat: number, lng: number): void {
  void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`);
}
