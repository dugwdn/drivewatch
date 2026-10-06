export interface SensorState {
  unlocked: boolean;
  unlockTimes: number[];
  handling: number;
  onCall: boolean;
  callRoute: string;
  audioRouteName: string;
  motionActive: boolean;
}
