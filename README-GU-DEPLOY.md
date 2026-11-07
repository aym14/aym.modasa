# AYM Smart Ledger v1.2.81 — Supabase Sync અને GitHub Backup

આ buildમાં **Supabase મુખ્ય ledger sync** છે. સફળ Supabase sync પછી વૈકલ્પિક રીતે GitHubના અલગ Private Repositoryમાં વધારાનો backup રાખી શકાય છે. JSONBin અને My Server બીજા provider તરીકે ઉપલબ્ધ રહે છે; એક સમયે એક મુખ્ય provider પસંદ થાય છે.

## પહેલાં Supabase તૈયાર કરો

1. `supabase/README-GU.md` વાંચો.
2. બંને migration SQL ફાઇલો ક્રમશઃ Supabase projectમાં લાગુ કરો.
3. Admin માટે Supabase Auth user બનાવો અને `aym_org_members`માં તેની active `admin` membership ઉમેરો.
4. Publishable key વાપરો. Supabase Secret/service-role key બ્રાઉઝર કે packageમાં ન મૂકો.

## એપમાં Supabase જોડો

1. `site/`ની ફાઇલો GitHub Pages publish rootમાં અપલોડ કરો. `index.html` સીધી rootમાં રહેવી જોઈએ અને `icons/` તેની બાજુમાં.
2. Settings → Cloud Sync → **Supabase મુખ્ય**માં URL, Publishable key, Admin email/passwordથી Sign in કરો.
3. **કનેક્શન તપાસો** દબાવો. પછી **મોકલો** દબાવી હાલના Ledgerનો પ્રથમ cloud snapshot બનાવો.
4. પ્રથમ snapshot પછી Auto Sync ચાલુ કરો. અન્ય trusted Admin devices પર દરેક deviceમાં Admin Supabase accountથી અલગ Sign in કરો.

Sign in કરેલું Supabase account organizationનું active Admin હોવું જોઈએ. Supabase password સેવ થતો નથી; session આ browserમાં રહે છે. Join QRમાં GitHub backup ચાલુ હોય તો GitHub token પણ આવી શકે છે, તેથી QR ફક્ત trusted Admin devicesમાં વાપરો.

## વૈકલ્પિક GitHub backup

GitHub tabમાં અલગ Private Data Repository, Owner અને Fine-grained token (Contents: Read and write) ગોઠવી Save અને Test કરો. પછી Supabase મુખ્ય tabમાં GitHub backup checkbox ચાલુ કરો. Websiteનો public source repository backup માટે વાપરશો નહીં.

## સ્થાનિક backup

Settings → Backup and restoreથી JSON backup download/restore કરી શકાય છે. Restore target deviceનો હાલનો ડેટા બદલે છે. આ cloud syncથી અલગ manual fallback છે; backup file ખાનગી રાખો.

સેટઅપ વિગત, migration અને ભૂલ સુધારવા માટે `supabase/README-GU.md` જુઓ.
