# Party email verification અને Admin OTP

## Admin Cloud Sync sign-in

Cloud Sync settingsમાં Supabase Project URL, Publishable Key અને સક્રિય Admin membership ધરાવતા Auth accountનું email દાખલ કરીને **ઇમેલ OTP મોકલો** દબાવો. Email Templateમાં `{{ .Token }}` રાખેલું હોય તો 6 અંકનો કોડ આવે છે. કોડ દાખલ કરીને **OTP ચકાસો અને જોડો** દબાવો. App `/auth/v1/otp`થી account બનાવ્યા વિના કોડ મંગાવે છે, `/auth/v1/verify`થી ચકાસે છે, અને snapshot access પહેલાં સક્રિય organization Admin membership તપાસે છે. OTP/password સાચવાતા નથી; session token આ browserમાં રહે છે.

Cloud Sync Settings appના Admin sessionની અંદર જ છે. Admin account appમાં local user તરીકે આ device/browserમાં ન હોય તો Admin Cloud Join link અથવા appના Admin sign-in setupથી access મેળવવો જરૂરી છે. Cloud Sync OTP Supabase Auth email account sign-in કરે છે; તે local app loginને આપમેળે બદલે નહીં.

## Live email OTP માટે ફરજિયાત Supabase સેટિંગ

એપ Party sign-in માટે Supabase Authના `/otp` અને `/verify` endpoints વાપરે છે. Email provider ચાલુ અને email confirmation ફરજિયાત હોવું જોઈએ. એપ OTP વિનંતી મોકલી શકે છે; દરેક Party સુધી mail પહોંચે તેની ખાતરી માટે નીચેની Dashboard ગોઠવણી પણ જરૂરી છે.

1. Supabase Dashboard → **Project Settings → Authentication → SMTP Settings**માં વિશ્વસનીય SMTP providerની વિગતો નાખીને custom SMTP ચાલુ કરો. Sender email તમારા domainમાં verify કરેલો હોવો જોઈએ. Supabaseના default SMTP પર સામાન્ય Partyના સરનામે mail પહોંચશે તેની ખાતરી નથી; તે testing માટે મર્યાદિત છે.
2. Dashboard → **Authentication → Email Templates → Magic Link** ખોલો. Templateમાં `{{ .Token }}` variable સામેલ કરો જેથી mailમાં OTP આંકડા આવે. ઉદાહરણ:

   **Subject:** `AYM Smart Ledger verification code`

   **Body:**

   ```html
   <h2>AYM Smart Ledger verification</h2>
   <p>Your one-time verification code is:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:6px">{{ .Token }}</p>
   <p>આ કોડ કોઈની સાથે શેર ન કરો. જો તમે વિનંતી ન કરી હોય તો આ mail અવગણો.</p>
   ```

3. Dashboard → **Authentication → URL Configuration**માં Site URL અને Redirect URLsમાં `https://aym14.github.io/aym.modasa/` ઉમેરો. App OTP link callback પણ સમર્થન આપે છે, પરંતુ આંકડાનો કોડ વાપરવા ઉપરનું template જરૂરી છે.
4. પહેલાં પોતાની નિયંત્રિત email addressથી signup/login અજમાવો. Mail ન મળે તો Spam/Junk, provider delivery log અને Supabase Auth Logs તપાસો. OTP વારંવાર માગતાં પહેલાં resend timer પૂરો થવા દો.

SMTP password/secret ફક્ત Supabase Dashboardમાં જ દાખલ કરો; તેને આ repository, `licensing-config.json`, QR code કે browser codeમાં ન મૂકો. Supabaseના default SMTPની વર્તમાન મર્યાદાઓ બદલાઈ શકે છે; custom SMTP setup જરૂરી છે. [Supabase SMTP setup](https://supabase.com/docs/guides/auth/auth-smtp) અને [email templates](https://supabase.com/docs/guides/auth/auth-email-templates) જુઓ.

Partyનું સામાન્ય login નોંધાયેલા ઈમેલ અને Partyના ચોક્કસ 6 અક્ષરના પાસવર્ડથી થાય છે. પહેલી વાર પાસવર્ડ સેટ કરવા અથવા ભૂલેલો પાસવર્ડ બદલવા નોંધાયેલ મોબાઇલથી Party record ઓળખીને તેના ઈમેલ પર OTP ચકાસવામાં આવે છે. Party Auth account માટે private internal email identity બને છે; તે Adminના Auth email/accountને બદલતું નથી. આ માટે `202611140001_aym_party_separate_password_auth.sql` અને `supabase functions deploy party-password-auth` જરૂરી છે. ઈમેલ OTP ચકાસ્યા પછી જ server Party record સાથે mobile/email mapping તપાસે છે અને password સેટ કરે છે.

Adminએ Party recordમાં સાચો mobile અને email રાખીને Sync કરવું. Party login modalમાં **પાસવર્ડ સેટ / ભૂલાયો?** પસંદ કરે, મોબાઇલ દાખલ કરે, નોંધાયેલ email પર આવેલ OTP ચકાસે અને Party password સેટ કરે. ત્યારબાદ ઈમેલ + Party passwordથી login થાય છે. આ accountને Admin role મળતો નથી.

## Partyને ડિફોલ્ટથી શું મળે

- પોતાના જમા, ખર્ચ, balance અને recent entries.
- પોતાના હિસાબનો category report અને મંજૂર print/PDF.
- પોતાની સંબંધિત loan forms/status અને loan applicationની ઉપલબ્ધ સુવિધાઓ.
- Admin સાથે સંબંધિત messages અને ઉપલબ્ધ guarantor view.
- Adminએ વધારાની role permissions આપી હોય તો વધારાની સુવિધાઓ દેખાઈ શકે છે.

Entry add/edit, loan approval/collection, settings, member management અને backup ડિફોલ્ટથી બંધ છે.

## મર્યાદા

Cloud portal માટે migrations લાગુ કરો. Adminના snapshotમાં દરેક Partyના `email` પરથી પસંદ કરેલા પોતાના recordsનું projection બને છે. Partyનું અલગ password Auth user `aym_my_party_data` RPCથી પોતાનો ડેટા મેળવે છે. RLS server-side Party mapping, confirmed internal Auth user અને active Party membership તપાસે છે; browserનો Party ID/email parameter access નક્કી કરતો નથી. Anonymous read અને Party write બંધ છે. સંપૂર્ણ Admin snapshot હજી Admin માટે જ છે. Adminએ Partyનો સાચો email/mobile રાખીને Sync કરવો જરૂરી છે. Email બદલાય કે Party દૂર થાય ત્યારે આગળના Admin Syncથી જૂનું projection દૂર થાય છે.

Cloud Party portal હાલમાં read-only છે: પોતાનો હિસાબ, profile, સંબંધિત loan summary અને print/PDF. Loan application, message sending, guarantor directory અને data edits માટે અલગ સુરક્ષિત write APIs બનાવ્યા વગર ઉપયોગ કરવો નહીં. Portal સ્થાનિક Admin ledger સાથે merge થતું નથી અને Party modeમાં base persist બંધ છે. Sign-out પછી in-memory data દૂર કરવા પેજ reload થાય છે. Server પર revoke કર્યા પછી પહેલેથી screen પર દેખાયેલ માહિતી પાછી ખેંચી શકાતી નથી; આગળનું authenticated fetch નવી policy લાગુ કરે છે.

`202611120001_aym_party_requests.sql` લાગુ થયા પછી અલગ Party request form ચાલુ થાય છે. Party વિષય અને વિગતો મોકલી શકે છે; verified email, active Party membership અને પોતાના projection સાથે મેળ ખાતી ઓળખ Supabase server ચકાસે છે. Admin inbox request જોઈને નવી/ચાલુ/પૂર્ણ સ્થિતિ રાખી શકે છે. આ request form ledger, loan application અથવા guarantor recordsમાં ફેરફાર કરતું નથી.

લાઇવ databaseમાં transaction-only isolation checks પાસ: પોતાના records, cross-Party denial, secret filtering, Admin snapshot denial, write denial, anonymous denial અને email revoke. Sample records rollback કર્યાં છે.

Email sendingની Supabase મર્યાદા અને custom SMTP configuration લાગુ રહે છે. પહેલી વાર password setup અથવા password reset માટે જ Partyના verified email પર OTP પહોંચવો જરૂરી છે. Migration અને Edge Function deploy થયા પછી જ આ login flow ઉપલબ્ધ થાય છે.
