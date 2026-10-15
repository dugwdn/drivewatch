import AVFoundation
import CallKit
import CoreMotion
import ExpoModulesCore
import UIKit

// Signals a normal iPhone app is allowed to read while running in the
// background during a drive:
// - when the phone is unlocked (protected data becomes available),
// - how much the phone is being moved around (a mounted phone stays still),
// - whether a call is active and where its audio goes (ear vs. car).
// iPhone does not tell apps which other app is open; that needs Apple's
// Screen Time permission and is a later phase.

struct SensorState: Record {
  @Field var unlocked: Bool = false
  @Field var unlockTimes: [Double] = []
  @Field var handling: Double = 0
  @Field var onCall: Bool = false
  @Field var callRoute: String = "none"
  @Field var audioRouteName: String = ""
  @Field var motionActive: Bool = false
}

public class DriveSensorsModule: Module {
  private let motion = CMMotionManager()
  private let motionQueue: OperationQueue = {
    let q = OperationQueue()
    q.name = "drivewatch.motion"
    q.maxConcurrentOperationCount = 1
    return q
  }()
  private let callObserver = CXCallObserver()
  private let lock = NSLock()
  private var unlocked = true
  private var unlockTimes: [Double] = []
  private var rotation: [(t: Double, v: Double)] = []
  private var observers: [NSObjectProtocol] = []

  private static let handlingWindowMs: Double = 4000

  public func definition() -> ModuleDefinition {
    Name("DriveSensors")

    OnCreate {
      self.startWatchingLock()
    }

    OnDestroy {
      self.stopMotionUpdates()
      for o in self.observers { NotificationCenter.default.removeObserver(o) }
      self.observers.removeAll()
    }

    /// Start reading motion. Called when a drive starts, to save battery otherwise.
    Function("startMotion") {
      self.startMotionUpdates()
    }

    Function("stopMotion") {
      self.stopMotionUpdates()
    }

    /// Current signals. With drain = true the list of unlock times is cleared after reading.
    Function("getState") { (drain: Bool) -> SensorState in
      return self.snapshot(drain: drain)
    }
  }

  private func now() -> Double {
    return Date().timeIntervalSince1970 * 1000
  }

  // MARK: Lock and unlock

  private func startWatchingLock() {
    let center = NotificationCenter.default
    observers.append(
      center.addObserver(
        forName: UIApplication.protectedDataDidBecomeAvailableNotification, object: nil, queue: nil
      ) { [weak self] _ in
        guard let self = self else { return }
        self.lock.lock()
        self.unlocked = true
        self.unlockTimes.append(self.now())
        if self.unlockTimes.count > 50 { self.unlockTimes.removeFirst(self.unlockTimes.count - 50) }
        self.lock.unlock()
      })
    observers.append(
      center.addObserver(
        forName: UIApplication.protectedDataWillBecomeUnavailableNotification, object: nil, queue: nil
      ) { [weak self] _ in
        guard let self = self else { return }
        self.lock.lock()
        self.unlocked = false
        self.lock.unlock()
      })
    DispatchQueue.main.async { [weak self] in
      guard let self = self else { return }
      let available = UIApplication.shared.isProtectedDataAvailable
      self.lock.lock()
      self.unlocked = available
      self.lock.unlock()
    }
  }

  // MARK: Motion

  private func startMotionUpdates() {
    guard motion.isDeviceMotionAvailable, !motion.isDeviceMotionActive else { return }
    motion.deviceMotionUpdateInterval = 0.1
    motion.startDeviceMotionUpdates(to: motionQueue) { [weak self] data, _ in
      guard let self = self, let data = data else { return }
      let r = data.rotationRate
      let magnitude = (r.x * r.x + r.y * r.y + r.z * r.z).squareRoot()
      let t = self.now()
      self.lock.lock()
      self.rotation.append((t: t, v: magnitude))
      let cutoff = t - DriveSensorsModule.handlingWindowMs
      while let first = self.rotation.first, first.t < cutoff { self.rotation.removeFirst() }
      self.lock.unlock()
    }
  }

  private func stopMotionUpdates() {
    if motion.isDeviceMotionActive { motion.stopDeviceMotionUpdates() }
    lock.lock()
    rotation.removeAll()
    lock.unlock()
  }

  // MARK: Calls and audio

  private func callInfo() -> (onCall: Bool, route: String, name: String) {
    let onCall = callObserver.calls.contains { $0.hasConnected && !$0.hasEnded }
    let output = AVAudioSession.sharedInstance().currentRoute.outputs.first
    let name = output?.portName ?? ""
    guard let port = output?.portType else { return (onCall, "none", name) }
    let route: String
    switch port {
    case .builtInReceiver: route = "receiver"
    case .builtInSpeaker: route = "speaker"
    case .bluetoothHFP, .bluetoothA2DP, .bluetoothLE: route = "bluetooth"
    case .carAudio: route = "carplay"
    case .headphones: route = "headphones"
    default: route = "other"
    }
    return (onCall, route, name)
  }

  // MARK: Snapshot

  private func snapshot(drain: Bool) -> SensorState {
    let call = callInfo()
    var state = SensorState()
    lock.lock()
    let cutoff = now() - DriveSensorsModule.handlingWindowMs
    state.unlocked = unlocked
    state.unlockTimes = unlockTimes
    state.handling = rotation.filter { $0.t >= cutoff }.map { $0.v }.max() ?? 0
    state.motionActive = motion.isDeviceMotionActive
    if drain { unlockTimes.removeAll() }
    lock.unlock()
    state.onCall = call.onCall
    state.callRoute = call.route
    state.audioRouteName = call.name
    return state
  }
}
