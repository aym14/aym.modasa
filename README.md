# મોબાઇલ એપ — AYM Ledger (Android)

ANSAR YUVA MANDAL, Modasa ની હિસાબ એપનું **Android એપ્લિકેશન** સ્વરૂપ.
આ એપની આખી અંદરની ફાઇલ `assets/` માં બંડલ થયેલી છે — એટલે **ઇન્ટરનેટ વગર પણ પૂરી એપ ચાલે છે**.

| વિગત | માહિતી |
|---|---|
| એપનું નામ | **AYM Ledger** |
| પેકેજ | `com.ansaryuvamandal.ledger` |
| વર્ઝન | 1.0.8 (versionCode 9) |
| સાઇઝ | ~795 KB |
| Android | 5.0 (API 21) થી 14 (API 34) સુધી |
| તૈયાર APK | `dist/AYM-Ledger.apk` |
| સહી (signing) | `keystore/aym-release.jks` |

---

## 1) ફોનમાં કેવી રીતે ઇન્સ્ટોલ કરવું

1. `AYM-Ledger.apk` ફાઇલ ફોનમાં લો (WhatsApp/USB/Google Drive થી).
2. ફાઇલ પર ટૅપ કરો → "Install" દબાવો.
3. પહેલી વાર **"Unknown sources / અજાણ્યા સ્રોત"** ની પરવાનગી માંગે તો
   *Settings → Apps → Special access → Install unknown apps* માંથી Chrome/Files ને મંજૂરી આપો.
4. ઇન્સ્ટોલ થયા પછી હોમ સ્ક્રીન પર **AYM Ledger** આઇકોન આવશે.
5. એપ ખોલો → **Create Admin** દબાવીને પોતાનું ખાતું બનાવો (નામ + મોબાઇલ + 8 અક્ષરનો પાસવર્ડ).

> Play Store પરથી ઇન્સ્ટોલ ન હોવાથી Android "અજાણી એપ" ની ચેતવણી દેખાડે — એ સામાન્ય છે.
> એપ કોઈ ઇન્ટરનેટ પરવાનગી સિવાય ડેટા મોકલતી નથી; બધો હિસાબ ફોનમાં જ રહે છે.

## 2) એપમાં શું મળે છે

- એન્ટ્રી, પાર્ટી, કેટેગરી, વિભાગ, લોન અરજી, જામીન ફેરફાર, રિપોર્ટ — વેબ એપના **બધા જ ફીચર**
- **પ્રિન્ટ**: એપનું પ્રિન્ટ બટન દબાવતાં Android નો પ્રિન્ટ ડાયલોગ ખૂલે — ત્યાંથી
  પ્રિન્ટર, **Save as PDF**, કે WhatsApp પર PDF શેર કરી શકાય (લોગો સાથેનું A4 લેટરહેડ)
- **ડાઉનલોડ**: બેકઅપ (JSON/CSV) ફોનના **Downloads** ફોલ્ડરમાં સેવ થાય
- **બેક બટન**: ખુલેલું પોપઅપ બંધ કરે; બે વાર દબાવો તો એપ બંધ
- **ઑફલાઇન**: એક વાર ખોલ્યા પછી ઇન્ટરનેટ વગર પણ પૂરું કામ ચાલે (ફોન્ટ/આઇકોન ઉપલબ્ધ હોય તો)

## 2.5) એપમાં જ અપડેટ

- એપ ચાલુ હોય ત્યારે `version.json` તપાસે → નવું વર્ઝન હોય તો **પૂછ્યા વગર જ** APK ડાઉનલોડ થાય (ઓટો અપડેટ ડિફોલ્ટ ચાલુ).
- નવું APK ડાઉનલોડ થઈને Android નો ઇન્સ્ટોલર જાતે ખૂલે → ફક્ત *Update* દબાવો. **ડેટા જળવાય રહે.**
- ઓટો અપડેટ બંધ કરવું હોય તો **સેટિંગ્સ → અપડેટ** માંથી ✓ કાઢી નાખો (પછી પટ્ટી + બટન આવશે).
- પહેલી વાર Android 8+ માં “Install unknown apps” ની મંજૂરી માંગે — એપ જાતે સેટિંગ ખોલી આપે છે.
- અપડેટ લિંક: **સેટિંગ્સ → અપડેટ** માં `…/version.json` ની પૂરી લિંક સેવ કરવી (એક જ વાર).
- સંબંધિત કોડ: `MainActivity.installUpdate()` + `ApkProvider.java` + `REQUEST_INSTALL_PACKAGES` પરવાનગી.

## 3) ડેટા ક્યાં રહે છે?

ડેટા એપની અંદરના બ્રાઉઝર સ્ટોરેજ (localStorage) માં રહે છે —
**એપ અપડેટ કરો તો ડેટા જળવાય રહે છે**, પણ *એપ અનઇન્સ્ટોલ* કરો તો ડેટા જાય.
એટલે **અઠવાડિયે એક વાર** સેટિંગ્સ → Data → **Export** કરી બેકઅપ લેવો (ફાઇલ Downloads માં સેવ થશે).
એકથી વધુ ફોનમાં એક જ હિસાબ જોઈએ તો સેટિંગ્સ → ક્લાઉડ સિંક → **Join QR** વાપરો.

---

## 4) એપમાં ફેરફાર કરીને ફરી બનાવવી (rebuild)

### રીત A — સ્ક્રિપ્ટથી (Gradle વગર, ઝડપી)
```bash
# જરૂર: JDK 11+ અને Android SDK (build-tools 34.0.0 + platform android-34)
export ANDROID_SDK_ROOT=~/Android/Sdk
cd mobile-app
APP_SRC=.. ./build-apk.sh        # એપની તાજી index.html assets/ માં કોપી થાય
# તૈયાર ફાઇલ → dist/AYM-Ledger.apk
```
એપની ફાઇલો બદલ્યા પછી (index.html માં સુધારો કરો) ફક્ત આ સ્ક્રિપ્ટ ફરી ચલાવો.

### રીત B — Android Studio થી
1. Android Studio → **New Project → Empty Views Activity** (ભાષા Java, package `com.ansaryuvamandal.ledger`).
2. આ ફોલ્ડરની `src/`, `res/`, `assets/`, `AndroidManifest.xml` ની ફાઇલો પ્રોજેક્ટમાં કોપી કરો.
3. Run ▶ અથવા Build → **Generate Signed Bundle / APK**.

### નામ / આઇકોન / વર્ઝન બદલવું
| શું બદલવું છે | ક્યાં |
|---|---|
| એપનું નામ | `res/values/strings.xml` → `app_name` |
| આઇકોન | `res/mipmap-*/ic_launcher.png` (+ `ic_launcher_foreground.png`) બદલો |
| સ્ટાર્ટઅપ કલર | `res/values/colors.xml` → `brand` |
| વર્ઝન | `AndroidManifest.xml` → `versionCode` / `versionName` |

> **મહત્ત્વનું:** એપ અપડેટ કરતી વખતે **એ જ `keystore/aym-release.jks`** વાપરવું પડે, નહીં તો ફોન
> નવું APK ઇન્સ્ટોલ નહીં કરે ("App not installed"). માટે આ ફાઇલ અને પાસવર્ડ સાચવી રાખો.
> કીસ્ટોરનો પાસવર્ડ: `aymledger2026`
>
> 🔒 **સુરક્ષા:** `keystore/` ફોલ્ડર **GitHub પર અપલોડ ન કરવું** (એના વગર બીજું કોઈ તમારી એપ
> નામે અપડેટ બનાવી શકતું નથી). એ ફાઇલ Google Drive/USB માં અલગ સાચવો.

## 5) Play Store પર મૂકવું હોય તો

1. Google Play Console ખાતું ખોલો (એક વખતની ₹1,900 જેવી ફી).
2. `.aab` (Android App Bundle) જોઈએ — Android Studio માંથી *Generate Signed Bundle* થી બનાવો.
3. Play Console → Create app → App content (privacy policy, data safety) ભરો →
   *Data safety* માં લખો: **ડેટા ફોનમાં જ સંગ્રહાય છે, કોઈ સર્વર પર મોકલાતો નથી**.
4. Internal testing માં પહેલાં 2-3 ફોન પર ટ્રાય કરો, પછી Production.

> Play Store વગર પણ ચાલે એવો સહેલો રસ્તો: **PWABuilder** (https://www.pwabuilder.com) પર
> GitHub Pages ની લિંક નાખો → તૈયાર APK/AAB મળે.

---

## ફાઇલ ક્યાં શું છે

```
mobile-app/
├── AndroidManifest.xml                     એપની ઓળખ, પરવાનગી, વર્ઝન
├── build-apk.sh                             APK બનાવવાની સ્ક્રિપ્ટ
├── src/com/ansaryuvamandal/ledger/
│   └── MainActivity.java                    WebView + પ્રિન્ટ + ડાઉનલોડ + ફાઇલ પસંદગી
├── res/
│   ├── values/{strings,colors,styles}.xml   નામ, કલર, થીમ
│   ├── values-v21/styles.xml                સ્ટેટસ બાર કલર
│   ├── mipmap-anydpi-v26/…                  Android 8+ adaptive આઇકોન
│   └── mipmap-*/                            બધા માપના આઇકોન
├── assets/                                  એપની અંદરની index.html + આઇકોન (ઑફલાઇન)
├── keystore/aym-release.jks                 સહી માટેની કી (સાચવી રાખવી!)
└── dist/AYM-Ledger.apk                      તૈયાર એપ
```

### ટેક્નિકલ નોંધ
- એપ `https://aym.local/index.html` થી લોડ થાય, જેની બધી ફાઇલો `assets/` માંથી આપવામાં આવે છે
  (એટલે ડેટા `file://` કરતાં વધુ ભરોસાપાત્ર રીતે સચવાય).
- `index.html` માં કોઈ ફેરફાર કર્યા વગર એપમાં પ્રિન્ટ/ડાઉનલોડ જોડાય છે (JS શિમ).
- બહારની લિંક (Google, WhatsApp, tel:) ફોનના બ્રાઉઝર/એપમાં ખૂલે.
