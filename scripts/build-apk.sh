#!/usr/bin/env bash
# Build the Android app and publish it at /bumply.apk.
#
# The Android app is a Trusted Web Activity: a thin Chrome shell that loads
# app.bumply.mom. That has an important consequence.
#
#   THE APK DOES NOT NEED REBUILDING WHEN YOU DEPLOY.
#
# Web changes reach it the moment they are live, because it loads the same site.
# Rebuild only when the shell itself changes: package id, name, icon, colours,
# or start URL. And rebuild with the SAME keystore every time, because the
# fingerprint in public/.well-known/assetlinks.json has to match, or Android
# stops trusting the link and shows a browser address bar over your app.
#
#   bash scripts/build-apk.sh
#
# Requirements, one time:
#   JDK 17+            brew install --cask temurin        (needs your password)
#   Bubblewrap         npm i -g @bubblewrap/cli
set -euo pipefail
cd "$(dirname "$0")/.."

command -v java >/dev/null 2>&1 || { echo "No JDK. Run: brew install --cask temurin"; exit 1; }
java -version 2>&1 | head -1

KEYSTORE="android/android.keystore"
if [ ! -f "$KEYSTORE" ]; then
  cat <<'MSG'

No signing keystore at android/android.keystore.

public/.well-known/assetlinks.json already carries a fingerprint from an earlier
build, so ONE of these is true:

  1. You still have that keystore. Copy it to android/android.keystore and
     rerun. The existing assetlinks stays valid and installs keep working.

  2. It is gone. Generate a new one, then update assetlinks.json to the new
     fingerprint, or the app will show a browser bar:

       keytool -genkeypair -v -keystore android/android.keystore \
         -alias bumply -keyalg RSA -keysize 2048 -validity 10000

     Then, after building:
       bubblewrap fingerprint list
     and paste the SHA-256 into public/.well-known/assetlinks.json.

Never commit the keystore. It is the only thing that lets you ship an update
to people who already installed the app.

MSG
  exit 1
fi

echo "==> building"
( cd android && npx --yes @bubblewrap/cli build --skipPwaValidation )

APK=$(find android -name "*.apk" -newer "$KEYSTORE" | head -1)
[ -n "$APK" ] || APK=$(find android -name "app-release-signed.apk" | head -1)
[ -n "$APK" ] || { echo "No APK produced. Check the bubblewrap output above."; exit 1; }

cp "$APK" public/bumply.apk
echo "==> published public/bumply.apk  ($(du -h public/bumply.apk | cut -f1))"
echo "    The download link appears on the home page automatically."
echo
echo "Verify the fingerprint still matches assetlinks.json:"
echo "    cd android && npx @bubblewrap/cli fingerprint list"
