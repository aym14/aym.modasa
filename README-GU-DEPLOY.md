# AYM Smart Ledger v1.2.83 — Supabase Sync અને GitHub Backup

આ buildમાં **Supabase મુખ્ય ledger sync** છે. સફળ Supabase sync પછી વૈકલ્પિક રીતે GitHubના અલગ Private Repositoryમાં વધારાનો backup રાખી શકાય છે. JSONBin અને My Server બીજા provider તરીકે ઉપલબ્ધ રહે છે; એક સમયે એક મુખ્ય provider પસંદ થાય છે.

## પહેલાં Supabase તૈયાર કરો

1. `supabase/README-GU.md` વાંચો.
2. `supabase/migrations/`ની ચારેય migration SQL ફાઇલો નામના ક્રમમાં Supabase projectમાં લાગુ કરો. છેલ્લી `202611090002_aym_party_portal.sql` verified emailથી પોતાના Party records વાંચવા માટે જરૂરી છે.
3. Admin માટે Supabase Auth user બનાવો અને `aym_org_members`માં તેની active `admin` membership ઉમેરો.
4. Publishable key વાપરો. Supabase Secret/service-role key બ્રાઉઝર કે packageમાં ન મૂકો.

## એપમાં Supabase જોડો

1. `site/`ની ફાઇલો GitHub Pages publish rootમાં અપલોડ કરો. `index.html` સીધી rootમાં રહેવી જોઈએ અને `icons/` તેની બાજુમાં.
2. Settings → Cloud Sync → **Supabase મુખ્ય**માં URL, Publishable key અને Admin email ભરો. **ઇમેલ OTP મોકલો** દબાવી inboxમાં આવેલ 6 અંકનો code નાખો અને **OTP ચકાસો અને જોડો** દબાવો.
3. **કનેક્શન તપાસો** દબાવો. પછી **મોકલો** દબાવી હાલના Ledgerનો પ્રથમ cloud snapshot બનાવો.
4. પ્રથમ snapshot પછી Auto Sync ચાલુ કરો. અન્ય trusted Admin devices પર દરેક deviceમાં Admin Supabase accountથી અલગ Sign in કરો.

Sign in કરેલું Supabase account organizationનું active Admin હોવું જોઈએ. OTP/password સેવ થતો નથી; session આ browserમાં રહે છે. Join QRમાં GitHub backup ચાલુ હોય તો GitHub token પણ આવી શકે છે, તેથી QR ફક્ત trusted Admin devicesમાં વાપરો.

## વૈકલ્પિક GitHub backup

GitHub tabમાં અલગ Private Data Repository, Owner અને Fine-grained token (Contents: Read and write) ગોઠવી Save અને Test કરો. પછી Supabase મુખ્ય tabમાં GitHub backup checkbox ચાલુ કરો. Websiteનો public source repository backup માટે વાપરશો નહીં.

## Sync વર્તન

Manual Pull cloud અને deviceના રેકોર્ડને merge કરે છે જેથી unsynced local ફેરફાર ન ઊડે. Cloudમાંથી વાંચવામાં permission/network ભૂલ આવે તો તે ખાલી database તરીકે ગણાતી નથી. અનેક devicesના સતત ફેરફારોને ત્રણ પ્રયાસમાં સરખાવી ન શકાય તો sync નિષ્ફળ બતાવે છે; ફરી પ્રયાસ કરો.

## સ્થાનિક backup

Settings → Backup and restoreથી JSON backup download/restore કરી શકાય છે. Restore target deviceનો હાલનો ડેટા બદલે છે. આ cloud syncથી અલગ manual fallback છે; backup file ખાનગી રાખો.

સેટઅપ વિગત, migration અને ભૂલ સુધારવા માટે `supabase/README-GU.md` જુઓ.

## GitHub Pages પર આ પેકેજ deploy કરો

આ standalone static app છે; npm install કે frontend build જરૂરી નથી.

1. આખું પેકેજ GitHub repositoryની `main` branchમાં મૂકો (`site/`, `tools/`, `.github/` અને `supabase/` સહિત).
2. Repository → Settings → Pages → Sourceમાં **GitHub Actions** પસંદ કરો.
3. `.github/workflows/pages.yml` પહેલા JavaScript/JSON અને regression checks ચલાવે છે અને ફક્ત `site/`ને publish કરે છે. `main` પર push કરો અથવા Actionsમાંથી workflow ચલાવો.
4. Workflowની deployment URL ખોલો; Admin login, Gujarati language, local backup/restore અને Supabase connection તપાસો.
5. બે trusted Admin devices પર અલગ entries બનાવી Push/Pull કરો; બંને entries બંને devices પર મળે તે ચકાસો. પછી offline કરીને એપ ફરી ખૂલે છે તે તપાસો.
6. જૂના ખુલ્લા tabs બંધ કરીને ફરી ખોલો જેથી બંને devices પર સુધારેલો sync code ચાલે.

સ્થાનિક validation: Node.js 22+ સાથે package rootમાં `node tools/healthcheck.cjs` ચલાવો.

આ તપાસમાં database migration/RLS execution, વાસ્તવિક OTP delivery અને authenticated cloud round-trip ચલાવ્યાં નથી. તેના માટે project/account access જરૂરી છે. Party/local login અને browserમાં બનતો SMS OTP server authorizationનું સ્થાન લેતા નથી; full cloud Ledger ફક્ત Supabaseના active Adminને RLSથી મળે છે. Public Party access માટે અલગ server-authorized, Party-scoped API જરૂરી છે.
