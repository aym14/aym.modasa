# AYM Smart Ledger — Supabase મુખ્ય Sync

Supabaseમાં organization-scoped ledger snapshot રાખવામાં આવે છે. આ full-ledger snapshot ફક્ત સક્રિય `admin` membership ધરાવતા Supabase Auth વપરાશકર્તા વાંચી/લખી શકે છે. Party login/OTP અલગ રહે છે. Browserમાં ફક્ત Publishable key વાપરો; Secret અથવા service-role key ક્યારેય ન મૂકો.

## Supabase project તૈયાર કરો

1. `migrations/`ની દસ SQL ફાઇલો નામના ક્રમમાં લાગુ કરો. છેલ્લી migration `202611120006_aym_party_workflow_hardening.sql` છે; તે Party projection તથા form submission માટે active membership ચકાસે છે, form fields validate કરે છે અને Admin update columns મર્યાદિત કરે છે. `202611120005` પહેલાં ઉમેરાયેલ temporary public mobile/email RPC દૂર કરે છે. Supabase CLIથી `supabase db push` અથવા Dashboard → SQL Editor વાપરો.
2. Dashboard → Authentication → Usersમાં Admin માટે email user બનાવો/પસંદ કરો. આ app password sign-in નથી કરતી; OTP મોકલવા પહેલાં Auth user હોવો જરૂરી છે. Project signup બંધ હોય તો Dashboardમાંથી user બનાવો, public signup ચાલુ ન કરો.
3. Admin membership ગોઠવવા માટે `setup_admin_cloud_sync.sql` વાપરો. તેમાં screenshotના Admin email અને organization name આપેલા છે; તમારી ગોઠવણી અલગ હોય તો ચલાવતા પહેલાં બંને બદલો. Query confirmed Auth user ચકાસે છે, organization ન હોય તો બનાવે છે, Admin membership idempotently upsert કરે છે અને અંતે પરિણામ બતાવે છે. `seed.example.sql` ફક્ત placeholder template છે; placeholder values ચલાવશો નહીં. `role` `admin` અને `is_active` true હોવું જોઈએ. OTP email એ જ Auth userના email સાથે મેળ ખાતું હોવું જોઈએ.
4. `site/licensing-config.json`માં project URL અને Publishable key જ રાખો. આ key browserમાં વાપરવા માટે છે; database policies સક્રિય રાખો.
5. Dashboard → Authentication → SMTP Settingsમાં working SMTP ગોઠવો, પછી `party-mobile-email-otp` Edge Function deploy કરો. `config.toml`માં આ function માટે `verify_jwt = false` છે કારણ કે Party sign-in પહેલાં session નથી; function mobile lookup, OTP send અને verify server-side કરે છે. Deploy પછી Supabase Edge Function logsમાં provider status તપાસી શકાય છે. Browserમાં Secret/service-role key ન મૂકો.

## એપમાં જોડો

1. Settings → Cloud Sync → **Supabase મુખ્ય** ખોલો.
2. Project URL અને Publishable key ચકાસો; Organization UUID ખાલી રાખો (એક જ સક્રિય organization હોય તો auto-fill થશે), Admin email નાખીને **ઇમેલ OTP મોકલો** દબાવો. Supabase Auth accountમાં આવેલ 6 અંકનો કોડ દાખલ કરીને ચકાસો. Password અથવા OTP સેવ થતો નથી; access/refresh session ફક્ત આ browserમાં રહે છે.
3. **કનેક્શન તપાસો** દબાવી Admin membership અને snapshot table ચકાસો.
4. પહેલા **મોકલો** દબાવી હાલના Ledgerનો પ્રથમ snapshot બનાવો. ત્યાર પછી જ Auto Sync ચાલુ કરો.
5. અન્ય વિશ્વાસપાત્ર Admin device પર પણ તેની પોતાની Supabase Auth sessionથી Sign in કરો. Join QR config આપી શકે છે, પરંતુ તેમાં Supabase password/session નથી.

દરેક sync પહેલાં local અને cloud records merge થાય છે. Supabase policy full Ledger snapshotને Admin role સુધી મર્યાદિત રાખે છે; Party accountને આ table access મળતો નથી. Party લોગિન માટે નોંધાયેલ મોબાઇલ અને ઈમેલ દાખલ કરે છે; જોડણી મેળ ખાતાં ઈમેલ OTP મોકલાય છે અને OTP પછી બંને વિગતો Party રેકોર્ડ સાથે ફરી ચકાસાય છે. Party portalમાં “ઓનલાઇન ફોર્મ”થી લોન અરજી અને જામીનદાર ફેરફાર મોકલી શકાય છે. Admin loginના “પાર્ટી અરજીઓ” inboxમાં ફોર્મ જોઈને નવી/તપાસમાં/મંજૂર/નામંજૂર સ્થિતિ તથા નોંધ સાચવી શકાય છે. સામાન્ય વિનંતીઓ માટેનું inbox પણ ઉપલબ્ધ છે.

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
- table/404 અથવા permission error: દસેય migrations યોગ્ય ક્રમમાં લાગુ થયા છે તેની ખાતરી કરો. Party projection permission error આવે તો membership `role='party'`, યોગ્ય `party_ref` અને `is_active=true` હોવી જોઈએ.
- OTP email ન આવે: Supabase Auth SMTP તથા `party-mobile-email-otp` Edge Function deploy/logs તપાસો. Unknown નંબર અને provider failure માટે response ઇરાદાપૂર્વક એકસરખો છે; account existence browserને જણાવાતી નથી.
- GitHub 401/403/404: PAT, private repo Owner/Name, branch અને Contents Read/Write તપાસો.

`service_role`/Secret key, database password અથવા GitHub token જાહેર repositoryમાં commit ન કરો.

