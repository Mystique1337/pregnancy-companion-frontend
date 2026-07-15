# Bumply — Android app

Bumply is a **PWA** (installable web app: manifest + service worker + offline `/sos`).
The app is server-rendered (auth + DB), so the Android app is a **native shell that
loads the live site** and works offline via the service worker. Two ways to ship it:

## Fastest: installable PWA (today, no build)
On Android Chrome at **https://app.bumply.mom** → menu → **Add to Home screen**.
It installs standalone (own icon, no browser bar), gets push notifications, and the
danger-sign check + ANC (`/sos`) work with **no network**.

## Real APK for the Play Store — PWABuilder (no Android SDK needed)
1. Go to **https://www.pwabuilder.com** and enter **https://app.bumply.mom**.
2. It reads the manifest (name, PNG icons 192/512 + maskable, theme `#C97B5A`).
3. **Package For Stores → Android → Generate** → download the signed **`.apk`/`.aab`**
   (a Trusted Web Activity that opens app.bumply.mom full-screen).
4. Sideload the `.apk` to test, or upload the `.aab` to Google Play.

## Alternative: Bubblewrap CLI (needs JDK + Android SDK)
```bash
npm i -g @bubblewrap/cli
bubblewrap init --manifest https://app.bumply.mom/manifest.webmanifest
bubblewrap build     # -> app-release-signed.apk
```

## Future: Capacitor (for on-device offline model)
To bundle an **on-device tiny model** (e.g. Qwen2.5-0.5B via llama.cpp, or Gemma 3 1B
via MediaPipe) for offline chat, wrap the same web code with **Capacitor** and add a
native LLM plugin. The rule-based offline core (`/sos`) already works without it.

Assets: `public/icon-192.png`, `public/icon-512.png`, `public/icon-512-maskable.png`,
manifest at `app/manifest.ts` (served at `/manifest.webmanifest`).
