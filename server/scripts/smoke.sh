#!/usr/bin/env bash
# Walks through a family, an invite, a drive, and a phone-use alert against a
# running API (default: local `npm run dev`). Usage: scripts/smoke.sh [base-url]
set -euo pipefail
B=${1:-http://localhost:8787}
J='content-type: application/json'
P=$(curl -s -XPOST $B/v1/families -H "$J" -d '{"familyName":"Test","parentName":"Parent"}'); PT=$(echo "$P" | jq -r .token)
CODE=$(curl -s -XPOST $B/v1/invites -H "authorization: Bearer $PT" -H "$J" -d '{"role":"driver"}' | jq -r .code)
DT=$(curl -s -XPOST $B/v1/join -H "$J" -d "{\"code\":\"$CODE\",\"name\":\"Sam\"}" | jq -r .token)
echo "code reuse: $(curl -s -XPOST $B/v1/join -H "$J" -d "{\"code\":\"$CODE\",\"name\":\"X\"}")"
NOW=$(($(date +%s)*1000))
echo "ingest: $(curl -s -XPOST $B/v1/ingest -H "authorization: Bearer $DT" -H "$J" -d "{\"status\":{\"permission\":\"always\",\"sentAt\":$NOW},\"trips\":[{\"id\":\"trip-$NOW\",\"startedAt\":$NOW,\"endedAt\":null}],\"points\":[{\"tripId\":\"trip-$NOW\",\"t\":$NOW,\"lat\":41.10,\"lng\":-81.44,\"speedMps\":18,\"heading\":90,\"accuracy\":5},{\"tripId\":\"trip-$NOW\",\"t\":$((NOW+5000)),\"lat\":41.101,\"lng\":-81.44,\"speedMps\":19,\"heading\":90,\"accuracy\":5}],\"events\":[{\"id\":\"ev-$NOW\",\"tripId\":\"trip-$NOW\",\"type\":\"phone_unlocked\",\"t\":$((NOW+5000)),\"lat\":41.101,\"lng\":-81.44,\"speedMps\":18.3,\"detail\":{\"speedMph\":41}}]}")"
echo "permission off: $(curl -s -XPOST $B/v1/ingest -H "authorization: Bearer $DT" -H "$J" -d "{\"status\":{\"permission\":\"when_in_use\",\"sentAt\":$NOW},\"trips\":[],\"points\":[],\"events\":[]}")"
echo "live: $(curl -s $B/v1/live -H "authorization: Bearer $PT")"
echo "trips: $(curl -s $B/v1/trips -H "authorization: Bearer $PT")"
echo "events: $(curl -s $B/v1/events -H "authorization: Bearer $PT")"
echo "trip detail (driver): $(curl -s $B/v1/trips/trip-$NOW -H "authorization: Bearer $DT" | head -c 400)"
echo "driver cannot invite: $(curl -s -XPOST $B/v1/invites -H "authorization: Bearer $DT" -d '{}')"
echo "passenger: $(curl -s -XPOST $B/v1/trips/trip-$NOW/passenger -H "authorization: Bearer $DT" -d '{"passenger":true}')"
echo "privacy page: $(curl -s -o /dev/null -w '%{http_code}' $B/privacy)"
echo "review code joins sample family: $(curl -s -XPOST $B/v1/join -H "$J" -d '{"code":"APPREVIEW","name":"Reviewer"}' | jq -r .member.familyId)"
echo "driver deletes account: $(curl -s -XDELETE $B/v1/me -H "authorization: Bearer $DT")"
echo "last parent deletes family: $(curl -s -XDELETE $B/v1/me -H "authorization: Bearer $PT")"
