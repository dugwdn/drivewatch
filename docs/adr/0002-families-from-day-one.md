# 0002: Families from day one, rules per family, typed events

- **Status:** Accepted, 2026-09-29 (Doug: family first, maybe a friend or two, "build so it can scale into a product without rebuilding")

## Decision
- Every record belongs to a family. A family has parents and drivers. Parents see their family; drivers see only their own drives.
- The rules are settings per family, not code: `families.phone_speed_mph` (default 25) and `max_speed_mph` (default 80). The phone keeps a copy; the server checks again before alerting.
- Every alert and change is a typed event (who, what, where, speed, time), like RightPlace. Reports read events.

## Why
Adding a friend's family is new rows, not new code, and a buyer later sees clean, countable data.
