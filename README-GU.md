# AYM Smart Ledger v1.2.80 — Ansar Yuva Mandal, Modasa

આ ફોલ્ડર GitHub Pages (કે કોઈ પણ static hosting) પર મૂકવા માટે તૈયાર છે. ફક્ત આ ફાઇલો જ જરૂરી છે — વધુ કંઈ ઉમેરવાની જરૂર નથી.

## 📁 ફોલ્ડરમાં શું છે

```
AYM-Ledger-v1.2.80/
├── index.html               ← આખી એપ (5.1 MB, single-file)
├── manifest.json            ← PWA install / નામ / રંગ / આઇકોન
├── sw.js                    ← offline cache + auto-update
├── licensing-config.json    ← Supabase URL + publishable key (Party OTP)
├── README-GU.md             ← આ સૂચના (એપ આને વાંચતી નથી)
└── icons/
    ├── app-icon-192.png
    ├── app-icon-512.png
    └── app-icon-maskable-512.png
```

⚠️ `icons/` ફોલ્ડરનું નામ અને અંદરની ફાઇલોનાં નામ બદલવાં નહીં — `manifest.json` અને `sw.js` આ જ પાથ વાપરે છે.

## 🚀 GitHub Pages પર મૂકવાની રીત

1. GitHub પર repository ખોલો → **Add file → Upload files**.
2. આ ફોલ્ડરની **બધી ફાઇલો** (અને `icons` ફોલ્ડર પણ) root માં અપલોડ કરો.
   - ધ્યાન: `index.html` root માં જ હોવી જોઇએ, કોઈ સબ-ફોલ્ડરમાં નહીં.
3. Commit કરો → **Settings → Pages** → Branch: `main`, Folder: `/ (root)` → Save.
4. થોડી વાર પછી `https://<user>.github.io/<repo>/` પર એપ ખૂલશે.
5. પહેલી વાર ઓનલાઇન ખોલો (એટલે service worker કેશ ભરાય), પછી offline પણ ચાલશે.
   - offline માટે ફોલ્ડરમાં `sw.js` + `manifest.json` + `icons/` હોવા જોઇએ. ફક્ત `index.html` એકલી હોય તો એપ ચાલુ રહે પણ offline કેશ થશે નહીં.
   - `sw.js` હોય તો જ એપ ઑફલાઇન ખૂલે છે; `http://` (localhost) પર પણ service worker ચાલે છે.

## 🔄 અપડેટ કરતી વખતે

- `index.html` બદલો ત્યારે `sw.js` માં `CACHE_NAME` નું વર્ઝન બદલો (હાલ: `v1.2.80-code89`).
  નહીં તો જૂનું કેશ ચાલુ રહેશે અને ફેરફાર દેખાશે નહીં.
- `.json` ફાઇલો (version.json / licensing-config.json) કેશમાંથી જૂની ન મળે — દર વખતે નેટવર્ક પરથી જ વાંચાય છે, એટલે અપડેટ તરત જ દેખાય.
- ફાઇલનાં નામમાં મોટા/નાના અક્ષર બરાબર રાખો (GitHub Pages Linux પર ચાલે છે).

## 🐙 GitHub Sync ગોઠવણ

1. GitHubમાં અલગ **Private** data repository બનાવો (ઉદાહરણ: `ansar-ledger-data`). Websiteની repositoryમાં ledger data ન મૂકો.
2. GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokensમાં token બનાવો. Repository accessમાં ફક્ત આ data repo પસંદ કરો અને **Contents: Read and write** permission આપો.
3. એપમાં Settings → Cloud → GitHubમાં Token અને Data Repo નાખો. Personal repository માટે Owner ખાલી રાખી શકાય; જોડાણ તપાસતી વખતે username આપોઆપ ભરાશે. Organization repo માટે Ownerમાં organizationનું નામ નાખો.
4. પહેલાં **GitHub જોડાણ તપાસો** દબાવો. પછી **હમણાં GitHub પર સેવ કરો** દબાવી પ્રથમ data file બનાવો. સફળ થયા પછી Auto Sync ચાલુ કરીને સામાન્ય **સેવ** દબાવો.
5. Token આ browserમાં જ રહે છે. Token અથવા cloud Join QR જાહેરમાં શેર ન કરો. ખાલી Token/Owner/Repo હોય તો Auto Sync બંધ રહેશે.
## 📱 Party app install

900px કે તેથી વધુ પહોળાઈએ desktop split layout દેખાય છે. નાની screenમાં login card mobile layoutમાં દેખાય છે. Party QR જાહેર app link ખોલે છે; તે password કે cloud sync key વહન કરતું નથી.

દરેક Party પોતાનો નોંધાયેલ મોબાઇલ/OTP વાપરે. Androidમાં browser menu → **Install app** અને iPhoneમાં Share → **Add to Home Screen** પસંદ કરી શકાય.

## 💾 Backup અને device transfer

Ledger Syncમાંથી Supabase દૂર છે. Settings → Backup and restoreમાં JSON file download કરો, બીજા deviceમાં મોકલો અને ત્યાં Restore from file કરો. Restore target deviceનો હાલનો ડેટા બદલે છે. આ manual transfer છે.

આ buildમાં Admin organization-license માટેનું Supabase sign-in form નથી; સામાન્ય Admin username/password login યથાવત છે. Party OTP login માટે `licensing-config.json`નું Supabase URL અને publishable key વપરાય છે. Settings → Cloudમાં JSONBin, My Server અથવા GitHub ગોઠવશો તો તે વૈકલ્પિક automatic provider તરીકે ચાલુ રહી શકે છે.

## 🔐 સુરક્ષા નોંધ

- `licensing-config.json` માંની `publishable` Supabase key public રહેવા માટે જ બનેલી છે — પણ Supabase માં **RLS (Row Level Security)** ચાલુ હોવું જરૂરી છે, નહીં તો ડેટા ખુલ્લો ગણાય.
- આ ફોલ્ડરમાં ક્યારેય **લેજરનો અસલ backup/export JSON**, admin password કે private API key ન મૂકો.
- `sync-config.json` વૈકલ્પિક છે; એમાં key હોય તો public repo માં ન મૂકવું.
