# AYM Smart Ledger — Supabase મુખ્ય Sync

Supabaseમાં organization-scoped ledger snapshot રાખવામાં આવે છે. આ full-ledger snapshot ફક્ત સક્રિય `admin` membership ધરાવતા Supabase Auth વપરાશકર્તા વાંચી/લખી શકે છે. Party login/OTP અલગ રહે છે. Browserમાં ફક્ત Publishable key વાપરો; Secret અથવા service-role key ક્યારેય ન મૂકો.

## Supabase project તૈયાર કરો

1. `migrations/`ની સાત SQL ફાઇલો નામના ક્રમમાં લાગુ કરો: access foundation, cloud ledger snapshots, snapshot write clock, Party portal, `202611120001_aym_party_requests.sql`, `202611120002_aym_party_request_projection_access.sql` અને `202611120003_aym_party_online_forms.sql`. Supabase CLIથી `supabase db push` અથવા Dashboard → SQL Editor વાપરો. છેલ્લી migration Party માટે લોન અરજી તથા જામીનદાર ફેરફારના સુરક્ષિત ફોર્મ બનાવે છે; Admin inboxમાં અરજીની સમીક્ષા અને સ્થિતિ/નોંધ સાચવી શકાય છે.
2. Dashboard → Authentication → Usersમાં Admin માટે email user બનાવો/પસંદ કરો. આ app password sign-in નથી કરતી; OTP મોકલવા પહેલાં Auth user હોવો જરૂરી છે. Project signup બંધ હોય તો Dashboardમાંથી user બનાવો, public signup ચાલુ ન કરો.
3. Admin membership ગોઠવવા માટે `setup_admin_cloud_sync.sql` વાપરો. તેમાં screenshotના Admin email અને organization name આપેલા છે; તમારી ગોઠવણી અલગ હોય તો ચલાવતા પહેલાં બંને બદલો. Query confirmed Auth user ચકાસે છે, organization ન હોય તો બનાવે છે, Admin membership idempotently upsert કરે છે અને અંતે પરિણામ બતાવે છે. `seed.example.sql` ફક્ત placeholder template છે; placeholder values ચલાવશો નહીં. `role` `admin` અને `is_active` true હોવું જોઈએ. OTP email એ જ Auth userના email સાથે મેળ ખાતું હોવું જોઈએ.
4. `site/licensing-config.json`માં project URL અને Publishable key જ રાખો. આ key browserમાં વાપરવા માટે છે; database policies સક્રિય રાખો.

## એપમાં જોડો

1. Settings → Cloud Sync → **Supabase મુખ્ય** ખોલો.
2. Project URL અને Publishable key ચકાસો; Organization UUID ખાલી રાખો (એક જ સક્રિય organization હોય તો auto-fill થશે), Admin email નાખીને **ઇમેલ OTP મોકલો** દબાવો. Supabase Auth accountમાં આવેલ 6 અંકનો કોડ દાખલ કરીને ચકાસો. Password અથવા OTP સેવ થતો નથી; access/refresh session ફક્ત આ browserમાં રહે છે.
3. **કનેક્શન તપાસો** દબાવી Admin membership અને snapshot table ચકાસો.
4. પહેલા **મોકલો** દબાવી હાલના Ledgerનો પ્રથમ snapshot બનાવો. ત્યાર પછી જ Auto Sync ચાલુ કરો.
5. અન્ય વિશ્વાસપાત્ર Admin device પર પણ તેની પોતાની Supabase Auth sessionથી Sign in કરો. Join QR config આપી શકે છે, પરંતુ તેમાં Supabase password/session નથી.

દરેક sync પહેલાં local અને cloud records merge થાય છે. Supabase policy full Ledger snapshotને Admin role સુધી મર્યાદિત રાખે છે; Party accountને આ table access મળતો નથી. Migration લાગુ થયા પછી Party portalમાં “ઓનલાઇન ફોર્મ”થી લોન અરજી અને જામીનદાર ફેરફાર મોકલી શકાય છે. Admin loginના “પાર્ટી અરજીઓ” inboxમાં ફોર્મ જોઈને નવી/તપાસમાં/મંજૂર/નામંજૂર સ્થિતિ તથા નોંધ સાચવી શકાય છે. સામાન્ય વિનંતીઓ માટેનું inbox પણ ઉપલબ્ધ છે.

## વૈકલ્પિક GitHub backup

1. અલગ **Private** Data Repository બનાવો અથવા GitHub tabમાંથી private repo બનાવો.
2. આ એક જ repo માટે Fine-grained Personal Access Token બનાવો; Contents permission `Read and write` હોવી જોઈએ.
3. GitHub tabમાં Token, Owner, Repo નાખી Save કરો અને **કનેક્શન તપાસો** દબાવો.
4. Supabase મુખ્ય tab પર પાછા જઈ “Supabase sync પછી GitHubમાં private backup પણ સાચવો” ચાલુ કરી Save કરો.

સફળ Supabase sync પછી snapshot GitHub private repoમાં પણ લખાય છે. GitHub token browserના local storageમાં રહે છે; Join QRમાં GitHub backup ચાલુ હોય તો token તેમાં આવશે. QR ફક્ત વિશ્વાસપાત્ર Admin device સાથે જ વાપરો. Websiteનો public source repo Data Repository તરીકે ન વાપરો.

## ભૂલ આવે તો

- `Could not reach Supabase`: URL સાચું છે, project ચાલુ છે અને network access છે તે તપાસો.
- `Signups not allowed for otp`: આ emailનું Auth user configured Supabase projectમાં મળ્યું નથી. Dashboard → Authentication → Usersમાં user બનાવો/ચકાસો; પછી તેનો UUID `aym_org_members.auth_user_id`ની `role='admin'`, `is_active=true` rowમાં જોડાયેલું હોવું જોઈએ. Public signups ચાલુ ન કરો.
- `Invalid login credentials`: જૂનું password-based app/PWA ખુલ્લું હોઈ શકે; નવી versionમાં email OTP વાપરો. Supabase Auth Usersમાં email account ચકાસો.
- membership/403: organization ID અને `aym_org_members` rowમાં Auth UUID, `role='admin'`, `is_active=true` ચકાસો.
- Organization ID validation error: અહીં Supabase project ref નહીં, UUID જોઈએ; field ખાલી રાખીને OTP ચકાસ્યા પછી auto-detect થવા દો.
- table/404 અથવા permission error: સાત migrations યોગ્ય ક્રમમાં લાગુ થયા છે તેની ખાતરી કરો.
- GitHub 401/403/404: PAT, private repo Owner/Name, branch અને Contents Read/Write તપાસો.

`service_role`/Secret key, database password અથવા GitHub token જાહેર repositoryમાં commit ન કરો.

