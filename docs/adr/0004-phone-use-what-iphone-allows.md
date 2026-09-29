# 0004: Phone use = unlock or handling over 25 mph; app names wait for Family Controls

- **Status:** Accepted, 2026-09-29 (Doug: the most important job is alerting a parent when the phone is used while moving over 25 mph)

## Decision
- A live parent alert, within seconds, when the driver's phone is unlocked or handled (rotation), or a call is held to the ear, while the car goes 25 mph or faster. A call on car Bluetooth or CarPlay is not handling.
- The alert names what we know, for example "Phone unlocked at 41 mph on Route 8, 7:42 PM", never an app we can't see.
- Which app was opened needs Apple's Family Controls (Screen Time) permission for parental apps, which Apple grants on request and which needs the teen in Family Sharing as a child. That's phase 3.

## Why
iPhone does not tell a normal app which other app is open. Claiming more than we know would be wrong. Rival apps like Life360 mostly report phone use after the trip; a live alert is the point of DriveWatch.

## Consequences
The handling threshold (`shared/phoneUse.ts` `HANDLING_RAD_S`) needs tuning on real drives so a passenger bump isn't an alert. Phase 2 adds the car Bluetooth check and an "I was a passenger" mark the parent can see.
