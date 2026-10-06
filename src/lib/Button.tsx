import { ActivityIndicator, Pressable, Text } from 'react-native';
import { ui } from './theme';

export function Button(props: { title: string; onPress: () => void; quiet?: boolean; busy?: boolean; disabled?: boolean }) {
  const { title, onPress, quiet, busy, disabled } = props;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy || disabled}
      style={({ pressed }) => [quiet ? ui.buttonQuiet : ui.button, { opacity: pressed || disabled ? 0.6 : 1 }]}
    >
      {busy ? (
        <ActivityIndicator color={quiet ? undefined : '#fff'} />
      ) : (
        <Text style={quiet ? ui.buttonQuietText : ui.buttonText}>{title}</Text>
      )}
    </Pressable>
  );
}
