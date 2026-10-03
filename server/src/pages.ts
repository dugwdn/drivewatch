// Public web pages Apple asks for: a privacy policy and a support page.
// Plain HTML served by the same Worker, so there is nothing else to host.

import type { Env } from './auth';

const UPDATED = 'September 29, 2026';

export function page(path: string, env: Env): Response {
  const email = env.SUPPORT_EMAIL ?? '';
  const mail = email ? `<a href="mailto:${email}">${email}</a>` : 'the email on our App Store listing';
  const body = path === '/privacy' ? privacy(mail) : path === '/support' ? support(mail) : home();
  return new Response(shell(body), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
}

function shell(body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>DriveWatch</title>
<style>
:root{--bg:#fff;--text:#1a1d21;--muted:#5b6470;--brand:#1f6feb;--line:#e3e7ec}
@media (prefers-color-scheme:dark){:root{--bg:#111418;--text:#eef1f4;--muted:#a3adb8;--brand:#5b9dff;--line:#2a3038}}
body{margin:0;background:var(--bg);color:var(--text);font:17px/1.55 -apple-system,system-ui,sans-serif}
main{max-width:720px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:30px;margin:8px 0 4px}h2{font-size:21px;margin:28px 0 6px}
p,li{color:var(--text)}.muted{color:var(--muted)}a{color:var(--brand)}
nav a{margin-right:16px}table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid var(--line);padding:8px 6px;text-align:left;vertical-align:top}
</style></head><body><main>
<nav><a href="/">DriveWatch</a><a href="/privacy">Privacy</a><a href="/support">Support</a></nav>
${body}
</main></body></html>`;
}

function home(): string {
  return `<h1>DriveWatch</h1>
<p>An iPhone app for parents of new drivers. It logs each drive on its own and tells parents right away if the
driver's phone is used while the car is going 25 mph or faster.</p>
<ul>
<li>Phone-use alerts within seconds</li>
<li>Live location and speed while driving</li>
<li>Drive history with a map of each drive</li>
<li>High-speed alerts</li>
<li>An alert if tracking is switched off</li>
</ul>
<p class="muted">The driver joins the family with a code a parent gives them, so they always know DriveWatch is on.</p>`;
}

function support(mail: string): string {
  return `<h1>DriveWatch support</h1>
<p>Questions or problems? Email ${mail}. We answer within two business days.</p>
<h2>Common fixes</h2>
<table>
<tr><th>Problem</th><th>Fix</th></tr>
<tr><td>No drives show up</td><td>On the driver's iPhone open Settings, then DriveWatch, then Location, and pick <b>Always</b>. Leave <b>Precise Location</b> on.</td></tr>
<tr><td>Parent gets no alerts</td><td>On the parent's iPhone open Settings, then Notifications, then DriveWatch, and turn on <b>Allow Notifications</b>.</td></tr>
<tr><td>A code does not work</td><td>Codes work once and expire after 7 days. A parent can make a new one in the app under <b>Family and rules</b>.</td></tr>
<tr><td>Rides where the driver was a passenger</td><td>The driver can switch on <b>I was a passenger</b> under that drive.</td></tr>
</table>
<h2>Delete your account</h2>
<p>Parents: open <b>Family and rules</b> and tap <b>Delete my account</b>. Drivers: scroll to the bottom of the home
screen and tap <b>Delete my account</b>. Your drives, locations, and alerts are erased from our server. If you are the
family's only parent, the whole family and all of its drives are erased.</p>`;
}

function privacy(mail: string): string {
  return `<h1>Privacy policy</h1>
<p class="muted">Last updated ${UPDATED}</p>
<p>DriveWatch helps a family see how its new driver drives. Everything it records is shared only inside that family.
We do not sell data, show ads, or use outside analytics or tracking services.</p>

<h2>What we collect</h2>
<table>
<tr><th>Data</th><th>Why</th></tr>
<tr><td>The first name each person types when they join</td><td>So the family knows who is who.</td></tr>
<tr><td>The driver's location and speed during drives, and their last known location</td><td>To log drives, show them on a map, and send speed alerts.</td></tr>
<tr><td>Phone-use signals during drives: the phone being unlocked, held and moved, or on a call held to the ear</td><td>To send phone-use alerts. We never see which app was opened, messages, or call contents.</td></tr>
<tr><td>Whether location access is set to Always</td><td>To tell parents when tracking is switched off.</td></tr>
<tr><td>A notification token for each parent's phone</td><td>To deliver alerts.</td></tr>
<tr><td>App-use counts: when the app is opened, which screen is shown, and actions like making an invite code or changing a rule</td><td>To see which parts of the app are used and fix what isn't working. These counts hold no location, names, or typed text.</td></tr>
</table>

<h2>Who can see it</h2>
<p>Parents in a family see that family's drivers, drives, and alerts. A driver sees only their own drives. No one
outside the family can see a family's data.</p>

<h2>Services we use</h2>
<p>Data is stored on Cloudflare's servers in the United States. Alerts are sent through Expo's push service and
Apple Push Notifications. They receive only what they need to do that job.</p>

<h2>How long we keep it</h2>
<p>The map route of each drive (its GPS points) is deleted automatically 90 days after the drive. Trip summaries
and alerts stay while the family uses DriveWatch. Anyone can delete their account in the app at any time,
which erases their data from our server. If the family's only parent deletes their account, the whole family is erased.</p>

<h2>Teen drivers</h2>
<p>DriveWatch is meant for a driver and their parent or guardian. A driver can only join with a code a parent gives
them, and the app asks the driver's permission for location and motion access, so the driver always knows it is on.</p>

<h2>Contact</h2>
<p>Email ${mail} with any privacy question or request.</p>`;
}
