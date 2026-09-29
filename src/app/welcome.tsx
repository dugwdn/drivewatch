import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { api, type JoinResult } from '../lib/api';
import { Button } from '../lib/Button';
import { saveSession } from '../lib/session';
import { ui } from '../lib/theme';

type Mode = 'choose' | 'start' | 'join';

export default function Welcome() {
  const [mode, setMode] = useState<Mode>('choose');
  const [name, setName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function finish(result: JoinResult) {
    await saveSession({
      token: result.token,
      memberId: result.member.id,
      role: result.member.role,
      name: result.member.name,
      familyId: result.member.familyId,
    });
    router.replace(result.member.role === 'parent' ? '/parent' : '/driver');
  }

  async function submit() {
    setError('');
    setBusy(true);
    try {
      if (mode === 'start') await finish(await api.createFamily(familyName, name));
      else await finish(await api.join(code, name));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={ui.pad} keyboardShouldPersistTaps="handled">
        <Text style={ui.h1}>Safer drives, together.</Text>
        <Text style={ui.body}>
          DriveWatch logs each drive on its own and tells parents right away if the phone is used while the car is moving.
        </Text>

        {mode === 'choose' && (
          <View style={{ gap: 12, marginTop: 12 }}>
            <Button title="I'm a parent: start a family" onPress={() => setMode('start')} />
            <Button title="I have a code" quiet onPress={() => setMode('join')} />
          </View>
        )}

        {mode !== 'choose' && (
          <View style={{ gap: 12, marginTop: 12 }}>
            {mode === 'start' ? (
              <>
                <Text style={ui.h2}>Start a family</Text>
                <TextInput style={ui.input} placeholder="Family name (for example, Smith)" value={familyName} onChangeText={setFamilyName} />
              </>
            ) : (
              <>
                <Text style={ui.h2}>Join with a code</Text>
                <Text style={ui.muted}>A parent makes the code in DriveWatch under Family and rules.</Text>
                <TextInput
                  style={ui.input}
                  placeholder="6-letter code"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  value={code}
                  onChangeText={setCode}
                />
              </>
            )}
            <TextInput style={ui.input} placeholder="Your first name" value={name} onChangeText={setName} textContentType="givenName" />
            {!!error && <Text style={ui.error}>{error}</Text>}
            <Button title={mode === 'start' ? 'Start' : 'Join'} onPress={submit} busy={busy} />
            <Button title="Back" quiet onPress={() => setMode('choose')} />
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
