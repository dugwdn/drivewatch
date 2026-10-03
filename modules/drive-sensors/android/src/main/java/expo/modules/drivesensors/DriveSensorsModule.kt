package expo.modules.drivesensors

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// iPhone comes first. Android returns "no signal" until it gets its own version.
class DriveSensorsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DriveSensors")

    Function("startMotion") {}

    Function("stopMotion") {}

    Function("getState") { _: Boolean ->
      mapOf(
        "unlocked" to false,
        "unlockTimes" to emptyList<Double>(),
        "handling" to 0.0,
        "onCall" to false,
        "callRoute" to "none",
        "audioRouteName" to "",
        "motionActive" to false
      )
    }
  }
}
