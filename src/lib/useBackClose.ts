import { useEffect, useRef } from 'react';
import { BackHandler } from 'react-native';

/**
 * Android hardware/gesture back steps back inside the app instead of exiting.
 *
 * While `active` is true, a back press calls `onBack` and is consumed. Use it
 * for anything that is not its own stack screen: an in-screen step (welcome's
 * start/join), a panel, a sheet. Handlers run newest-first, so the top-most
 * layer closes first. When nothing is active (a home screen), back falls
 * through to the OS and leaves the app normally.
 *
 * Not needed for: Expo Router stack screens (the stack pops on back and on iOS
 * swipe-back), RN <Modal> (use its `onRequestClose`), Alert.alert (pass
 * `{ cancelable: true }`).
 */
export function useBackClose(active: boolean, onBack: () => void): void {
  const onBackRef = useRef(onBack);
  onBackRef.current = onBack;

  useEffect(() => {
    if (!active) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onBackRef.current();
      return true;
    });
    return () => sub.remove();
  }, [active]);
}
