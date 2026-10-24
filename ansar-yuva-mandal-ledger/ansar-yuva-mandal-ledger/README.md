# ANSAR YUVA MANDAL, Modasa — Smart Ledger

સંસ્થાના હિસાબ માટેની **સિંગલ-ફાઇલ વેબ એપ**. એક જ `index.html` માં આખી એપ — કોઈ સર્વર, ડેટાબેઝ કે બિલ્ડ સ્ટેપની જરૂર નહીં.
ડેટા બ્રાઉઝરના `localStorage` માં સંગ્રહાય છે, એટલે ઇન્ટરનેટ વગર પણ કામ ચાલે.

> **Single-file web app** for the organisation's accounts: entries, parties, categories, custom
> modules, loans, guarantor changes, reports and A4 printing — no backend, no build step.

---

## ઝડપી શરૂઆત (Quick start)

1. `index.html` ડાઉનલોડ કરો અને બ્રાઉઝરમાં ખોલો.
2. પ્રથમ વખત **Create Admin** પર ક્લિક કરીને પોતાનું એડમિન ખાતું બનાવો (નામ + પાસવર્ડ).
3. સેટિંગ્સ → **Logo** માં સંસ્થાનું નામ/લોગો, **દેખાવ** માં પ્રિન્ટ સેટિંગ ગોઠવો.
4. હિસાબ શરૂ કરો — “નવી એન્ટ્રી”.

> પહેલી વાર ખોલો ત્યારે ફોન્ટ (Google Fonts) અને આઇકોન (Font Awesome) CDN પરથી આવે છે; પછી બ્રાઉઝર કેશમાં રહે.

---

## ફીચર્સ

| વિભાગ | વિગત |
|---|---|
| **એન્ટ્રી** | તારીખ, પાર્ટી, કેટેગરી (એક એન્ટ્રીમાં અનેક લાઇન), વાઉચર નં., ચુકવણી પ્રકાર, નોંધ |
| **પાર્ટી / કેટેગરી** | ઉમેરો, સુધારો, ડિલીટ; પાર્ટીવાઇઝ સારાંશ ટેબલ |
| **વિભાગ (Modules)** | અલગ હિસાબ — રેકોર્ડ, હપ્તા, વિગત પોપઅપ |
| **લોન અરજી** | વિગતવાર ફોર્મ, ફોટો, શરતો, જામીનદાર, હપ્તા |
| **જામીન ફેરફાર** | ફોર્મ + જામીનદાર પસંદગી |
| **રિપોર્ટ** | તારીખ રેન્જ, પાર્ટી/કેટેગરી ફિલ્ટર, ગ્રુપિંગ, વિગત સાથે |
| **પ્રિન્ટ** | A4/A5 લેટરહેડ, લોગો, સહી બોક્સ, રકમ શબ્દોમાં, ગુજરાતી હેડર, પૂર્વદર્શન |
| **યુઝર** | એડમિન (પૂરો હિસાબ) અને પાર્ટી લોગિન (ફક્ત પોતાનું ખાતું) |
| **બેકઅપ** | સેટિંગ્સ → Data (એક્સપોર્ટ/ઇમ્પોર્ટ), ક્લાઉડ સિંક (વૈકલ્પિક) |
| **મોબાઇલ** | નીચેનો ડોક, ટચ-ફ્રેન્ડલી ફોર્મ, હોમ સ્ક્રીન આઇકોન (PWA) |

---

## ફાઇલ સ્ટ્રક્ચર

```
ansar-yuva-mandal-ledger/
├── index.html              ← આખી એપ (HTML + CSS + JS)
├── manifest.json           ← PWA મેનિફેસ્ટ (હોમ સ્ક્રીન)
├── icon.svg                ← ફેવિકોન
├── sync-config.json        ← (વૈકલ્પિક) ક્લાઉડ સિંક સેટિંગ — નમૂનો બંધ (enabled:false)
├── icons/
│   ├── app-icon-512.png            Android / PWA
│   ├── app-icon-192.png            Android હોમ સ્ક્રીન
│   ├── app-icon-maskable-512.png   Android adaptive
│   ├── apple-touch-icon.png        iPhone / iPad (180)
│   ├── favicon-64.png              બ્રાઉઝર ટેબ
│   ├── logo.png                    લેટરહેડ પ્રિન્ટ માટે
│   └── icon-preview.png            આઇકોન પેકનું નમૂનો ચિત્ર
├── docs/
│   ├── CHANGELOG-gu.md             બધા સુધારાની નોંધ (ગુજરાતી)
│   └── print-suggestions-gu.md     પ્રિન્ટ સૂચનો
├── samples/
│   └── sample-print-a4.pdf         પ્રિન્ટ નમૂનો
├── .nojekyll                       GitHub Pages માટે
└── README.md
```

---

## GitHub પર મૂકવાની રીત

### રીત 1 — બ્રાઉઝરથી (સહેલી)
1. GitHub પર **New repository** → નામ `ansar-yuva-mandal-ledger`, **Public**, Create.
2. **Add file → Upload files** → આ ફોલ્ડરની **બધી ફાઇલો** (index.html, manifest.json, icon.svg, icons/, README.md …) ડ્રેગ કરો → **Commit changes**.
3. **Settings → Pages** → *Source*: **Deploy from a branch** → Branch: `main`, folder: `/ (root)` → Save.
4. થોડી વારે લિંક મળશે: `https://<તમારું-નામ>.github.io/ansar-yuva-mandal-ledger/`

### રીત 2 — Git કમાન્ડથી
```bash
cd ansar-yuva-mandal-ledger
git init
git add .
git commit -m "Ansar Yuva Mandal Smart Ledger"
git branch -M main
git remote add origin https://github.com/<USERNAME>/ansar-yuva-mandal-ledger.git
git push -u origin main
```
પછી **Settings → Pages** માંથી Pages ચાલુ કરો (ઉપર મુજબ).

> **નોંધ:** GitHub Pages પર લિંક ખૂલશે ત્યારે ડેટા એ જ બ્રાઉઝરમાં સંગ્રહાય છે — દરેક ફોન/કોમ્પ્યુટરનો હિસાબ અલગ રહે. એક જ હિસાબ બધે જોઈએ તો સેટિંગ્સ → Data ના એક્સપોર્ટ/ઇમ્પોર્ટનો ઉપયોગ કરો (અથવા ક્લાઉડ સિંક ગોઠવો).

---

## એકથી વધુ ડિવાઇસમાં એક જ હિસાબ (વૈકલ્પિક)

ડિફોલ્ટમાં ડેટા એ જ બ્રાઉઝરમાં રહે છે. બધા ફોન/કોમ્પ્યુટરમાં **એક જ હિસાબ** જોઈએ તો:

1. એપમાં **સેટિંગ્સ → ક્લાઉડ સિંક** ખોલો → Supabase / JSONBin / GitHub / Server માંથી એક પસંદ કરી Key ભરો → **Save**.
2. એ જ સ્ક્રીન પર **“⬇️ sync-config.json”** બટન દબાવો.
3. મળેલી `sync-config.json` ફાઇલને `index.html` ની બાજુમાં (GitHub રિપોમાં રૂટમાં) મૂકો.
4. હવે બીજા ફોનમાં લિંક ખોલતાં જ એપ આપમેળે ડેટા સાથે જોડાઈ જશે.
   (અથવા **Join QR** બનાવીને બીજા ફોનથી સ્કેન કરો.)

> ⚠️ આ ફાઇલમાં ગુપ્ત Key હોય છે. રિપો પબ્લિક હોય તો `sync-config.json` અપલોડ **ન** કરો —
> જે-તે ડિવાઇસ પર Join QR / ફાઇલથી જોડો. રિપોમાં મૂકેલી ડિફોલ્ટ ફાઇલ `enabled:false` છે, એટલે એ કંઈ કરતી નથી.

## પ્રિન્ટ

- દરેક સ્ક્રીન પર **પ્રિન્ટ કેન્દ્ર** (એન્ટ્રી યાદી / રિપોર્ટ હેડરમાં) — પૂર્વદર્શન સાથે A4/A5, લોગો, સહી બોક્સ, રકમ શબ્દોમાં.
- પસંદગી: **સેટિંગ્સ → દેખાવ → “પ્રિન્ટ અને લેટરહેડ”** અને **સેટિંગ્સ → Columns → “પ્રિન્ટમાંથી કોલમ દૂર કરો”**.
- મોબાઇલમાં બ્રાઉઝરના મેનુ → Share → Print કરતાં પણ એ જ લેટરહેડ આવે છે.
- PDF જોઈએ તો પ્રિન્ટ વિન્ડોમાં **“Save as PDF”** પસંદ કરો.

## મોબાઇલ એપ જેવી (PWA)

- Android Chrome: મેનુ → **Add to Home screen** → લોગો સાથેનું આઇકોન.
- iPhone Safari: Share → **Add to Home Screen**.
- આઇકોન માપ: 192, 512, maskable 512, apple-touch 180, favicon 64 (બધા `icons/` માં).

---

## ટેક્નિકલ

> **નોંધ:** એપમાં વૈકલ્પિક `server` પ્રકારનું ક્લાઉડ સિંક છે, જે ચાલુ કરવા માટે અલગ સર્વર જોઈએ. GitHub Pages (સ્ટેટિક હોસ્ટિંગ) પર એ ભાગ ઉપલબ્ધ નથી — એપ સંપૂર્ણપણે સ્થાનિક (localStorage) મોડમાં ચાલે છે, એટલે કોઈ ભૂલ નહીં આવે. એકથી વધુ ડિવાઇસમાં ડેટા જોઈએ તો **Supabase / JSONBin / GitHub** પ્રકાર વાપરો.


- એક જ ફાઇલ, કોઈ ફ્રેમવર્ક નહીં — સાદું HTML/CSS/JS.
- ડેટા: `localStorage` (કી ઉપરથી `fm_*`).
- ફોન્ટ: Noto Sans Gujarati + Inter (Google Fonts), આઇકોન: Font Awesome (CDN) — ઇન્ટરનેટ વગર ફોન્ટ/આઇકોન ન આવે પણ એપ ચાલશે.
- બ્રાઉઝર સપોર્ટ: Chrome / Edge / Safari / Firefox ના આધુનિક વર્ઝન (મોબાઇલ + ડેસ્કટોપ).
- પ્રિન્ટ: `@page` A4/A5, Chrome/Edge માં સૌથી સારું પરિણામ.

## લાઇસન્સ / ક્રેડિટ

આ એપ અને લોગો **ANSAR YUVA MANDAL, Modasa** માટે બનાવેલા છે.
જરૂર પડે તો બીજા મંડળ માટે નામ/લોગો સેટિંગ્સમાંથી બદલી શકાય.
