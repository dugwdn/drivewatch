# 0001: iPhone first, one Expo app for driver and parent

- **Status:** Accepted, 2026-09-29 (Doug)

## Context
Doug's son is about to turn 16 and has an iPhone. A website can't track drives: browsers stop sending location in the background, so the driver's phone needs a real app. Doug has no Mac.

## Decision
- One Expo (React Native) app. Signing in as a parent shows the live map, drives and alerts; signing in as a driver shows setup and their own drives. No second app.
- Builds run in Expo's cloud (EAS), so no Mac is needed. TestFlight puts it on family and friends' iPhones.
- The phone sensors iPhone won't expose to JavaScript (unlock and lock, phone in hand, calls and audio route) are a small local Swift module, `modules/drive-sensors/`. Android is a stub for now.

## Why
React Native is close to the React used in RightPlace, Android can come later from the same code, and Doug's Apple Developer account ($99 a year) already covers it.

## Consequences
Swift errors only show up in the first cloud build. The App Store name "DriveWatch" is taken by another developer, so the listing is "DriveWatch (d5baeb)" until Doug renames it (on his to-do list: "DriveWatch Family"). The home screen and TestFlight still say DriveWatch.
