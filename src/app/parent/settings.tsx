import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Share, Text, View } from 'react-native';
import type { FamilyRules, Role } from '../../../shared/types';
import { api, type FamilyInfo } from '../../lib/api';
import { Button } from '../../lib/Button';
import { agoText } from '../../lib/format';
import { clearSession } from '../../lib/session';
import { colors, ui } from '../../lib/theme';

export default function Settings() {
  const [info, setInfo] = useState<FamilyInfo | null>(null);
  const [rules, setRules] = useState<FamilyRules | null>(null);
  const [invite, setInvite] = useState<{ code: string; role: Role; expiresAt: number } | null>(null);
  const [busy, setBusy] = useState<string>('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const f = await api.family();
      setInfo(f);
      setRules(f.rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function changeRule(key: keyof FamilyRules, delta: number) {
    if (!rules) return;
    const next = { ...rules, [key]: rules[key] + delta };
    setRules(next);
    try {
      setRules((await api.updateRules({ [key]: next[key] })).rules);
    } catch (e) {
      setRules(rules);
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  async function makeInvite(role: Role) {
    setBusy(role);
    setError('');
    try {
      setInvite(await api.invite(role));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not make a code.');
    } finally {
      setBusy('');
    }
  }

  function remove(id: string, name: string) {
    Alert.alert(`Remove ${name}?`, "Their phone is signed out of DriveWatch. Past drives are kept.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await api.removeMember(id).catch(() => undefined);
          await load();
        },
      },
    ]);
  }

  function signOut() {
    Alert.alert('Sign out of DriveWatch on this phone?', 'You will need a new code from another parent to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await clearSession();
          router.replace('/welcome');
        },
      },
    ]);
  }

  if (!info || !rules) {
    return <Text style={[ui.pad, error ? ui.error : ui.muted]}>{error || 'Loading...'}</Text>;
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.pad}>
      <Text style={ui.h1}>{info.family.name}</Text>
      {!!error && <Text style={ui.error}>{error}</Text>}

      <Text style={[ui.h2, { marginTop: 8 }]}>Rules</Text>
      <Stepper
        label="Alert for phone use at or above"
        value={`${rules.phoneSpeedMph} mph`}
        onMinus={() => changeRule('phoneSpeedMph', -5)}
        onPlus={() => changeRule('phoneSpeedMph', 5)}
      />
      <Stepper
        label="Alert for high speed at or above"
        value={`${rules.maxSpeedMph} mph`}
        onMinus={() => changeRule('maxSpeedMph', -5)}
        onPlus={() => changeRule('maxSpeedMph', 5)}
      />

      <Text style={[ui.h2, { marginTop: 8 }]}>People</Text>
      {info.members.map((m) => (
        <View key={m.id} style={[ui.card, ui.row]}>
          <View style={{ flex: 1 }}>
            <Text style={ui.body}>
              {m.name} {m.id === info.me.id ? '(you)' : ''}
            </Text>
            <Text style={ui.muted}>
              {m.role === 'parent' ? 'Parent' : `Driver · last update ${agoText(m.last_seen_at)}`}
            </Text>
          </View>
          {m.id !== info.me.id && (
            <Pressable onPress={() => remove(m.id, m.name)} hitSlop={10}>
              <Text style={{ color: colors.danger, fontSize: 16 }}>Remove</Text>
            </Pressable>
          )}
        </View>
      ))}

      <Text style={[ui.h2, { marginTop: 8 }]}>Add someone</Text>
      <Button title="Make a code for a driver" onPress={() => makeInvite('driver')} busy={busy === 'driver'} />
      <Button title="Make a code for another parent" quiet onPress={() => makeInvite('parent')} busy={busy === 'parent'} />
      {invite && (
        <View style={[ui.card, { alignItems: 'center' }]}>
          <Text style={ui.muted}>{invite.role === 'driver' ? 'Driver code' : 'Parent code'}</Text>
          <Text selectable style={{ fontSize: 36, fontWeight: '700', letterSpacing: 6, color: colors.text }}>
            {invite.code}
          </Text>
          <Text style={ui.muted}>Works once. Expires {new Date(invite.expiresAt).toLocaleDateString()}.</Text>
          <Text style={[ui.body, { textAlign: 'center' }]}>
            On their iPhone: open DriveWatch, tap "I have a code", and type it in.
          </Text>
          <Button
            title="Share code"
            quiet
            onPress={() => Share.share({ message: `Your DriveWatch code is ${invite.code}. Open DriveWatch, tap "I have a code", and type it in.` })}
          />
        </View>
      )}

      <View style={{ marginTop: 24 }}>
        <Button title="Sign out on this phone" quiet onPress={signOut} />
      </View>
    </ScrollView>
  );
}

function Stepper(props: { label: string; value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={[ui.card, ui.row]}>
      <Text style={[ui.body, { flex: 1 }]}>{props.label}</Text>
      <View style={[ui.row, { gap: 14 }]}>
        <Pressable onPress={props.onMinus} hitSlop={10} accessibilityLabel="Lower">
          <Text style={{ fontSize: 26, color: colors.brand }}>−</Text>
        </Pressable>
        <Text style={[ui.body, { fontWeight: '600', minWidth: 64, textAlign: 'center' }]}>{props.value}</Text>
        <Pressable onPress={props.onPlus} hitSlop={10} accessibilityLabel="Raise">
          <Text style={{ fontSize: 26, color: colors.brand }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}
