import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { SensorState } from './DriveSensors.types';

declare class DriveSensorsModule extends NativeModule<{}> {
  startMotion(): void;
  stopMotion(): void;
  getState(drain: boolean): SensorState;
}

// Optional so the app still opens in tools that lack the native part (for
// example Expo Go); the drive log then records location only.
export default requireOptionalNativeModule<DriveSensorsModule>('DriveSensors');
