import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { api } from './api';
import { EAS_PROJECT_ID } from './config';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Ask for alert permission and send this phone's push address to the server. */
export async function registerForAlerts(): Promise<boolean> {
  if (!Device.isDevice) return false;
  const current = await Notifications.getPermissionsAsync();
  let granted = current.granted;
  if (!granted) {
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    granted = asked.granted;
  }
  if (!granted) return false;
  const { data } = await Notifications.getExpoPushTokenAsync({ projectId: EAS_PROJECT_ID });
  await api.savePushToken(data);
  return true;
}
