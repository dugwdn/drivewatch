import { Stack, router, useNavigation, type Href } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { colors } from './theme';
import { useBackClose } from './useBackClose';

/**
 * Visible on-screen Back arrow for the top-left of a non-home screen (use it as
 * a header's `headerLeft`). 44pt tap target, accessibility label "Back".
 * Stack screens with history already get the native header back arrow.
 */
export function BackButton({ onPress }: { onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      style={({ pressed }) => ({ minWidth: 44, minHeight: 44, justifyContent: 'center', opacity: pressed ? 0.5 : 1 })}
    >
      <Text style={{ color: colors.brand, fontSize: 17 }}>‹ Back</Text>
    </Pressable>
  );
}

/**
 * For a non-home stack screen opened with no screen behind it (a
 * drivewatch:// link): shows a header Back arrow and makes Android back go to
 * `home` instead of closing the app. Renders nothing in the normal case.
 */
export function BackToHomeIfFirst({ home }: { home: Href }) {
  const first = !useNavigation().canGoBack();
  const goHome = () => router.replace(home);
  useBackClose(first, goHome);
  if (!first) return null;
  return <Stack.Screen options={{ headerLeft: () => <BackButton onPress={goHome} /> }} />;
}

/** Leave signed-in screens for `href` with nothing left behind it to go back to. */
export function startOver(href: Href): void {
  if (router.canDismiss()) router.dismissAll();
  router.replace(href);
}
