# 0005: Never ask the driver to tap anything while moving; catch tampering instead

- **Status:** Accepted, 2026-09-29

## Decision
- Drives start and end on their own. The app never shows the driver a prompt while the car is moving (Ohio's hands-free law, and it would cause the very thing we alert on).
- The likeliest way it fails is a teen switching it off, so the parent is told when location is turned off, the app stops reporting, or the phone goes quiet mid-drive.
- Doug's free Screen Time settings on his son's iPhone (don't allow location changes or deleting apps, a passcode he doesn't know) back this up. Steps are in the build plan.
