#!/usr/bin/env bash
# ANSAR YUVA MANDAL — Smart Ledger · APK બનાવવાની સ્ક્રિપ્ટ (Gradle વગર, સીધું Android SDK થી)
#
# જરૂર: JDK 11+ અને Android SDK (build-tools 34 + platform 34)
# વાપરવું:
#   ANDROID_SDK_ROOT=/path/to/android-sdk ./build-apk.sh
# તૈયાર ફાઇલ: dist/AYM-Ledger.apk
set -euo pipefail
cd "$(dirname "$0")"

SDK="${ANDROID_SDK_ROOT:-$HOME/Android/Sdk}"
BT="$SDK/build-tools/34.0.0"
AJAR="$SDK/platforms/android-34/android.jar"
[ -x "$BT/aapt2" ] || { echo "❌ build-tools 34.0.0 મળ્યું નહીં: $BT"; exit 1; }
[ -f "$AJAR" ] || { echo "❌ android-34 platform મળ્યું નહીં: $AJAR"; exit 1; }

OUT=dist
B=.build
rm -rf "$B"; mkdir -p "$B/res" "$B/classes" "$B/gen" "$B/dex" "$OUT"

echo "1/6  એપની ફાઇલો assets/ માં…"
# એપની ફાઇલો ક્યાંથી લેવી: APP_SRC (ડિફોલ્ટ: આ ફોલ્ડરની બહારનું રૂટ) — ન મળે તો
# પ્રોજેક્ટમાં પહેલેથી રહેલી assets/ વપરાય.
APP_SRC="${APP_SRC:-..}"
if [ -f "$APP_SRC/index.html" ] && [ -f "$APP_SRC/manifest.json" ]; then
  echo "     લેવામાં આવે છે: $APP_SRC"
  mkdir -p assets/icons
  cp "$APP_SRC/index.html" "$APP_SRC/manifest.json" assets/
  [ -f "$APP_SRC/sw.js" ] && cp "$APP_SRC/sw.js" assets/ || true
  [ -f "$APP_SRC/icon.svg" ] && cp "$APP_SRC/icon.svg" assets/ || true
  [ -f "$APP_SRC/sync-config.json" ] && cp "$APP_SRC/sync-config.json" assets/ || true
  # version.json એપની અંદર જ હોવું જોઈએ — નહીં તો ઓટો-અપડેટ તપાસ નિષ્ફળ જાય
  [ -f "$APP_SRC/version.json" ] && cp "$APP_SRC/version.json" assets/ || true
  # આઇકોન + ફોન્ટ + PDF/QR લાઇબ્રેરી એપની અંદર જ (ઑફલાઇન ચાલે)
  if [ -d "$APP_SRC/vendor" ]; then
    rm -rf assets/vendor
    mkdir -p assets/vendor
    cp -R "$APP_SRC/vendor/." assets/vendor/
  fi
  if [ -d "$APP_SRC/icons" ]; then
    cp "$APP_SRC/icons/app-icon-192.png" "$APP_SRC/icons/app-icon-512.png" \
       "$APP_SRC/icons/app-icon-maskable-512.png" "$APP_SRC/icons/apple-touch-icon.png" \
       "$APP_SRC/icons/favicon-64.png" assets/icons/ 2>/dev/null || true
  fi
fi
[ -f assets/index.html ] || { echo "❌ assets/index.html મળ્યું નહીં — APP_SRC=… સેટ કરો"; exit 1; }

echo "2/6  રિસોર્સ કમ્પાઇલ…"
"$BT/aapt2" compile --dir res -o "$B/res.zip"

echo "3/6  લિંક (manifest + assets)…"
"$BT/aapt2" link -o "$B/base.apk" -I "$AJAR" \
  --manifest AndroidManifest.xml -R "$B/res.zip" \
  --java "$B/gen" --min-sdk-version 21 --target-sdk-version 34 \
  --auto-add-overlay -A assets

echo "4/6  Java કમ્પાઇલ + DEX…"
javac -encoding UTF-8 -source 8 -target 8 -nowarn -bootclasspath "$AJAR" -d "$B/classes" \
  $(find src "$B/gen" -name '*.java') 2>/dev/null || \
javac -encoding UTF-8 -source 8 -target 8 -nowarn -classpath "$AJAR" -d "$B/classes" \
  $(find src "$B/gen" -name '*.java')
"$BT/d8" --lib "$AJAR" --min-api 21 --output "$B/dex" $(find "$B/classes" -name '*.class')

echo "5/6  APK ગોઠવણ…"
cp "$B/base.apk" "$B/unsigned.apk"
( cd "$B" && zip -q -j unsigned.apk dex/classes.dex )
"$BT/zipalign" -f -p 4 "$B/unsigned.apk" "$B/aligned.apk"

echo "6/6  સહી (sign)…"
KS=keystore/aym-release.jks
if [ ! -f "$KS" ]; then
  mkdir -p keystore
  keytool -genkeypair -v -keystore "$KS" -alias aym -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass aymledger2026 -keypass aymledger2026 \
    -dname "CN=Ansar Yuva Mandal, O=AYM Ledger, L=Modasa, ST=Gujarat, C=IN" >/dev/null 2>&1
fi
"$BT/apksigner" sign --ks "$KS" --ks-pass pass:aymledger2026 --key-pass pass:aymledger2026 \
  --out "$OUT/AYM-Ledger.apk" "$B/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT/AYM-Ledger.apk" | head -4

echo "✅ તૈયાર: $(pwd)/$OUT/AYM-Ledger.apk"
ls -lh "$OUT/AYM-Ledger.apk"
