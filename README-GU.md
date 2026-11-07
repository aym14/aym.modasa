# AYM Smart Ledger — Supabase મુખ્ય Sync

Supabaseમાં organization-scoped ledger snapshot રાખવામાં આવે છે. આ full-ledger snapshot ફક્ત સક્રિય `admin` membership ધરાવતા Supabase Auth વપરાશકર્તા વાંચી/લખી શકે છે. Party login/OTP અલગ રહે છે. Browserમાં ફક્ત Publishable key વાપરો; Secret અથવા service-role key ક્યારેય ન મૂકો.

## Supabase project તૈયાર કરો

1. `supabase/migrations/202611030001_aym_access_foundation.sql` અને પછી `supabase/migrations/202611070001_aym_cloud_ledger_snapshots.sql` લાગુ કરો. Supabase CLI વાપરતા project link કર્યા પછી `supabase db push` ચલાવો; નહીં તો બંને SQL ફાઇલ ક્રમશઃ Dashboard → SQL Editorમાં ચલાવો.
2. Dashboard → Authentication → Usersમાં Admin માટે Email/Password user બનાવો અથવા પહેલેથી બનેલો user પસંદ કરો.
3. `seed.example.sql`માં organization અને તે Auth userનું UUID મૂકી organization/member rows ઉમેરો. Placeholder values ચલાવશો નહીં. `role` `admin` અને `is_active` true હોવું જોઈએ.
4. `site/licensing-config.json`માં project URL અને Publishable key જ રાખો. આ key browserમાં વાપરવા માટે છે; database policies સક્રિય રાખો.

## એપમાં જોડો

1. Settings → Cloud Sync → **Supabase મુખ્ય** ખોલો.
2. Project URL અને Publishable key ચકાસો; Admin Supabase email/passwordથી Sign in કરો. Password સેવ થતો નથી; access/refresh session ફક્ત આ browserમાં રહે છે.
3. **કનેક્શન તપાસો** દબાવી Admin membership અને snapshot table ચકાસો.
4. પહેલા **મોકલો** દબાવી હાલના Ledgerનો પ્રથમ snapshot બનાવો. ત્યાર પછી જ Auto Sync ચાલુ કરો.
5. અન્ય વિશ્વાસપાત્ર Admin device પર પણ તેની પોતાની Supabase Auth sessionથી Sign in કરો. Join QR config આપી શકે છે, પરંતુ તેમાં Supabase password/session નથી.

દરેક sync પહેલાં local અને cloud records merge થાય છે. Supabase policy full Ledger snapshotને Admin role સુધી મર્યાદિત રાખે છે; Party accountને આ table access મળતો નથી.

## વૈકલ્પિક GitHub backup

1. અલગ **Private** Data Repository બનાવો અથવા GitHub tabમાંથી private repo બનાવો.
2. આ એક જ repo માટે Fine-grained Personal Access Token બનાવો; Contents permission `Read and write` હોવી જોઈએ.
3. GitHub tabમાં Token, Owner, Repo નાખી Save કરો અને **કનેક્શન તપાસો** દબાવો.
4. Supabase મુખ્ય tab પર પાછા જઈ “Supabase sync પછી GitHubમાં private backup પણ સાચવો” ચાલુ કરી Save કરો.

સફળ Supabase sync પછી snapshot GitHub private repoમાં પણ લખાય છે. GitHub token browserના local storageમાં રહે છે; Join QRમાં GitHub backup ચાલુ હોય તો token તેમાં આવશે. QR ફક્ત વિશ્વાસપાત્ર Admin device સાથે જ વાપરો. Websiteનો public source repo Data Repository તરીકે ન વાપરો.

## ભૂલ આવે તો

- `Could not reach Supabase`: URL સાચું છે, project ચાલુ છે અને network access છે તે તપાસો.
- `Invalid login credentials`: Authentication → Usersમાં Admin user/password ચકાસો; એપના local Admin passwordથી આ અલગ હોઈ શકે છે.
- membership/403: organization ID અને `aym_org_members` rowમાં Auth UUID, `role='admin'`, `is_active=true` ચકાસો.
- table/404 અથવા permission error: બંને migrations યોગ્ય ક્રમમાં લાગુ થયા છે તેની ખાતરી કરો.
- GitHub 401/403/404: PAT, private repo Owner/Name, branch અને Contents Read/Write તપાસો.

`service_role`/Secret key, database password અથવા GitHub token જાહેર repositoryમાં commit ન કરો.
