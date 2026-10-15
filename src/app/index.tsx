import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { getSession, type Session } from '../lib/session';
import { ui } from '../lib/theme';

export default function Index() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    getSession().then(setSession, () => setSession(null));
  }, []);

  if (session === undefined) {
    return (
      <View style={[ui.screen, { justifyContent: 'center' }]}>
        <ActivityIndicator />
      </View>
    );
  }
  if (!session) return <Redirect href="/welcome" />;
  return <Redirect href={session.role === 'parent' ? '/parent' : '/driver'} />;
}
