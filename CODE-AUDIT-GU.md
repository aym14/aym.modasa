# કોડ નોંધ — AYM Smart Ledger v1.2.82

## 2026-11-09 તપાસ અને સુધારા

- In-memory Supabase session હવે project URL અને publishable key સાથે ચકાસાય છે; project બદલાય ત્યારે જૂનું token વપરાતું નથી.
- Supabaseમાં merge પછી unconditional upsertની જગ્યાએ timestamp-conditional PATCH / first INSERT થાય છે. Concurrent change અથવા duplicate first insert પર ફરી fetch/merge થાય છે (વધુમાં વધુ ત્રણ પ્રયાસ). Server write-clock માટે ત્રીજી migration ઉમેરેલી છે; તે લાગુ કરવી જરૂરી છે.
- GitHub SHA conflict પર જૂના payloadને નવા SHA સાથે overwrite કરવાને બદલે બહારની merge loop ફરી ચાલે છે.
- સફળ verification પછી જ last-sync/base સાચવાય છે. Supabase online pill અને non-GitHub hosting માટે app QR URL સુધાર્યાં. Offline worker માટે નવું cache નામ છે.
- GitHub Pages workflowમાં validation પછી ફક્ત site publish થાય છે.
- 52 inline JavaScript blocks, service worker, config JSON અને icon paths ચકાસ્યાં. Actual app functionsના mocked regression checksમાં stale update, first-insert race, permission failure અને project-scoped session પાસ થયા.
- Browserમાં initial page અને Admin login switch પર uncaught JavaScript error મળ્યો નહીં; visible broken images નહોતાં.
- મર્યાદા: આ સંપૂર્ણ end-to-end certification નથી. Live database/RLS, external OTP/SMS અને authenticated Supabase/GitHub sync ચલાવ્યાં નથી. SQL trigger runtime અને બે-device sync deployment પહેલાં વાસ્તવિક project પર તપાસવા જરૂરી છે. હાલનું Party/local login તથા client-generated SMS OTP server-side access control તરીકે માનવા યોગ્ય નથી.

- Supabaseને મુખ્ય cloud ledger sync તરીકે ચાલુ કર્યું; session refresh, Admin membership ચકાસણી, organization-scoped snapshot upsert અને merge-based pull/push ઉમેર્યાં.
- `aym_cloud_ledger_snapshots` માટે અલગ RLS migration ઉમેર્યું. Select/insert/update માત્ર સક્રિય Admin membershipને મળે છે.
- GitHubને વૈકલ્પિક secondary backup બનાવ્યું; Private repo તપાસે છે અને Supabase sync સફળ થયા પછી snapshot લખે છે. GitHub backup નિષ્ફળ થાય તો Supabase sync સફળ જ રહે છે અને ભૂલ log/statusમાં દેખાય છે.
- Supabase અને GitHub credentials active provider બદલતી વખતે જાળવાય છે. Join QRમાં Supabase password/session સામેલ નથી; GitHub backup ચાલુ હોય તો token સામેલ હોઈ શકે છે.
- Manual Pull હવે cloud અને local records merge કરે છે; unsynced local ફેરફારને ખોટી રીતે last-synced base તરીકે સાચવાતો અટકાવ્યો.
- Cloud fetchની network, permission અને HTTP ભૂલ હવે ખાલી cloud તરીકે ગણાતી નથી; concurrent-deviceના ત્રણ પ્રયાસ પછી પણ conflict રહે તો sync failure બતાવે છે.
- બધા inline scriptsનું syntax check કર્યું. Live Supabase/GitHub data પર sync ચલાવ્યું નથી; remote credentials, migrations અને RLS આ તપાસમાં ચકાસાયા નથી.

## પછીની સમીક્ષામાં સુધારા

- Appનું `1.2.82` / code `84` release metadata embedded update record અને service-worker cache સાથે મેળ ખાતું કર્યું.
- Local merge base હવે backend/project અને dataset ઓળખે છે: Supabase organization + sync key, server URL + sync key, અને GitHub owner/repository/branch/path. અલગ dataset માટે જૂનો merge base ફરી વપરાતો નથી.
- 52 inline JavaScript blocks, service worker, JSON config અને embedded update metadataનું syntax/parse validation ફરી કર્યું. Live Supabase/GitHub data પર sync ચલાવ્યું નથી.

## 2026-11-14 સમીક્ષા (v1.2.98)

### સુધારેલું
- Party OTP લંબાઈ: Edge Function અને `party-mobile-email-login.js` ફક્ત 8 અંક સ્વીકારતાં હતાં, જ્યારે દસ્તાવેજ 6 અંક કહે છે (Supabase email OTP length 6–10 ગોઠવી શકાય). હવે 6 થી 10 અંક સ્વીકારાય છે.
- `sw.js`: `.js/.json` ફાઇલો હવે network-first છે; જૂની cached `party-cloud.js` / `party-requests.js` નવા deploy પછી પણ ચાલતી રહે તેવી સમસ્યા દૂર. Cache નામ `v1.2.98-sw-otp-fix`.

### બીજા રાઉન્ડમાં સુધારેલું (v1.2.98)
- **ગંભીર બગ:** `party-password-auth`માં Party પાસવર્ડ login હંમેશા નિષ્ફળ જતું હતું (`email` ચલ બ્લોકમાં પછીથી જાહેર થતો હોવાથી ReferenceError → `party_password_setup_failed`). ચલનું નામ `aliasEmail` કર્યું; login હવે ચાલે છે.
- OTP `send`: નોંધાયેલ અને અનોંધાયેલ નંબર બંને માટે સરખો `{ok:true}` જવાબ (નંબર enumeration બંધ); અનોંધાયેલ નંબરને ઈમેલ જતો નથી.
- Rate limit: OTP send (નંબર દીઠ 5 / 15 મિનિટ), OTP verify (10), password login (ઈમેલ+IP દીઠ 10), password set. ઇન-મેમરી, દરેક instance માટે; Supabase Authની પોતાની મર્યાદા ઉપરાંત.
- Login પર ઈમેલ ન મળે/ડુપ્લિકેટ હોય તો બંને માટે એક જ `invalid_party_credentials` જવાબ.
- નવો Party પાસવર્ડ 8–64 અક્ષર (જૂના 6 અક્ષરના પાસવર્ડથી login ચાલુ રહે છે).
- Functions હવે આખું ledger JSON નહીં, ફક્ત `data->parties` વાંચે છે (ઓછો ડેટા, ઝડપી).
- CORS: Supabase Function secret `AYM_ALLOWED_ORIGINS` (દા.ત. `https://aym14.github.io`) મૂકો તો ફક્ત એ origin ચાલશે; ન મૂકો તો અગાઉ જેમ `*`.
- નવો `tools/edge-functions.test.mjs` regression test, GitHub workflowમાં જોડ્યો.
- Deploy: `supabase functions deploy party-mobile-email-otp party-password-auth`.

### હજી ખુલ્લું (આર્કિટેક્ચર બદલવું પડે)
- Party session (refresh token) `localStorage`માં સચવાય છે; `index.html`માં બે જગ્યાએ `new Function(...eval...)` છે (CSP લાગુ કરવી હોય તો પહેલાં આ દૂર કરવું).
- Invite link 365 દિવસ માન્ય (SQL function બદલવી પડે).
- Rate limit instance-wise છે; કડક global limit માટે Supabaseમાં table-આધારિત counter જોઈએ.
- Live Supabase પર આ ફેરફારો ચકાસ્યા નથી (ફક્ત mocked tests).
