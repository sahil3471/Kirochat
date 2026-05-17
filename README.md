# Dartmouth Eats Tracker

A small mobile web app (PWA) for delivery drivers in Dartmouth, NS. Logs your
deliveries, calculates `$/hr` and `$/km`, ranks your best zones / restaurants /
hours, and tells you where to be right now based on a Dartmouth-specific
playbook (6 am – midnight).

Works offline once installed. All data stays on your phone (localStorage).

## Features

- **Now** tab — clock + live recommendation of which Dartmouth zone to be in.
- **Log** tab — quick form to capture pay, tip, distance, time, restaurant.
- **Stats** tab — earnings, $/hr, $/km, best zones (by day of week), best &amp;
  worst restaurants, best hour by day. Filter by today / 7 days / 30 days /
  all time. The "Best zones" and "Best hour" cards highlight the top pick for
  the current day-of-week + time slot at the top.
- **Plan** tab — fully data-driven. Shows the best zone right now, today's
  per-2-hour-slot plan, and the best slot for each day of the week, all
  computed from your own logged deliveries.
- **Export CSV** — pull all your logged deliveries into a spreadsheet.

## How "best zone" is computed

Every delivery is bucketed into a `(day-of-week, 2-hour window, zone)` tuple.
For each bucket we sum total earnings (pay + tip) and total minutes, then
compute `$/hr = earn / (min / 60)`.

When asked for the "best" zone for a given slot, we:

1. Filter to buckets in that day &amp; time window.
2. Prefer buckets with at least 2 deliveries (so a single big tip doesn't
   skew the answer).
3. Pick the highest `$/hr` among those.
4. If no bucket has 2+ deliveries yet, fall back to the highest total
   earnings so the user still sees something useful.

## Hosting (free)

The app is plain static files. To put it on your phone, just serve
`index.html` from any static host. Easiest options:

### Option 1 — GitHub Pages (recommended)

1. Push this folder to a GitHub repo (already done if you're reading this in the
   `Kirochat` repo).
2. On GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set:
   - **Source:** Deploy from a branch
   - **Branch:** `main` (or whichever branch holds these files), folder `/ (root)`
4. Save. After ~1 minute GitHub will give you a URL like
   `https://<your-username>.github.io/Kirochat/`.

### Option 2 — Netlify / Cloudflare Pages

Drag-and-drop the folder into the Netlify dashboard or connect the repo to
Cloudflare Pages. No build command, publish directory `/`.

## Install on your phone

Once the site is live at an `https://` URL, open it in your phone browser and
add it to your home screen. It will then launch fullscreen, no browser bar,
and work offline.

### iPhone (Safari)

1. Open the URL in **Safari** (not Chrome — iOS Chrome can't install PWAs).
2. Tap the **Share** button (square with up arrow) at the bottom.
3. Scroll down and tap **Add to Home Screen**.
4. Confirm the name "Dartmouth Eats" → **Add**.
5. Launch from the new home-screen icon. You're done.

### Android (Chrome)

1. Open the URL in Chrome.
2. Tap the **⋮** menu (top right).
3. Tap **Add to Home screen** (or **Install app** if it appears).
4. Confirm. Launch from the home screen.

After installation:
- The app opens fullscreen like a native app.
- All your logged deliveries are stored on the device.
- It works offline — no signal needed at the parking lot.
- Use **Export CSV** periodically to back up your data.

## Privacy

There is no server, no account, no analytics, no tracking. All data is stored
in your browser's `localStorage` on the device.

## Files

```
index.html              # UI shell with all 4 tabs
styles.css              # Mobile-first dark theme
app.js                  # All logic (storage, tabs, stats, export)
playbook.js             # Dartmouth schedule data + zone & restaurant lists
manifest.webmanifest    # PWA manifest
sw.js                   # Service worker (offline cache)
icons/                  # PNG icons used by the manifest and Apple touch icon
scripts/make_icons.py   # Regenerates the icons (stdlib only, no deps)
```

## Tweaking the playbook

Edit `playbook.js`. Each entry in `PLAYBOOK` has:

```js
{
  start: 11.5,            // 11:30am, decimal hour
  end:   13.5,            // 1:30pm
  dow:   [1,2,3,4,5],     // weekdays only; null = every day
  zone:  "Burnside (Wright Ave corridor)",
  why:   "Office-worker lunches. Very high ping rate, short trips...",
  detail:"Park near the Wright Ave Tim's / Subway / Pita Pit block..."
}
```

The **Now** tab automatically picks the entry matching the current time and
day of week, with day-specific entries preferred over generic ones.
