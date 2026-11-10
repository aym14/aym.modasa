# Party email verification

Party login હવે નોંધાયેલ ઇમેલથી verification link અથવા email code વાપરે છે; મોબાઇલ OTP જરૂરી નથી. મોબાઇલ નંબર ફક્ત સ્થાનિક Party account શોધવા ઉપયોગી છે. Email verification મોબાઇલની માલિકી verify કરતું નથી.

Admin પહેલાં Party record અને તેના સાથે role `party` ધરાવતું login તથા સાચો email ગોઠવે. Party પોતે verification mail મંગાવી શકે છે. Link તે જ browser/deviceમાં ખોલવી જ્યાં mail મંગાવ્યો હોય. નવી tabમાં પણ pending request local storageથી મળે છે; token local storageમાં pending request સાથે રાખાતો નથી. Callback Supabase `/user`થી token અને confirmed email તપાસ્યા પછી જ સ્થાનિક Party સાથે જોડે છે. Missing/unmatched Party record હોય તો login થતું નથી. Admin role આપવામાં આવતો નથી.

## Partyને ડિફોલ્ટથી શું મળે

- પોતાના જમા, ખર્ચ, balance અને recent entries.
- પોતાના હિસાબનો category report અને મંજૂર print/PDF.
- પોતાની સંબંધિત loan forms/status અને loan applicationની ઉપલબ્ધ સુવિધાઓ.
- Admin સાથે સંબંધિત messages અને ઉપલબ્ધ guarantor view.
- Adminએ વધારાની role permissions આપી હોય તો વધારાની સુવિધાઓ દેખાઈ શકે છે.

Entry add/edit, loan approval/collection, settings, member management અને backup ડિફોલ્ટથી બંધ છે.

## મર્યાદા

Cloud portal માટે `202611090002_aym_party_portal.sql` લાગુ કરો. Adminના snapshotમાં દરેક Partyના `email` પરથી પસંદ કરેલા પોતાના recordsનું projection બને છે. Party નવા ફોનમાં email verify કરીને `aym_my_party_data` RPCથી પોતાનો ડેટા મેળવે છે. RLS verified Auth email સાથે rows મેળવે છે; browserનો Party ID/email parameter access નક્કી કરતો નથી. Anonymous read અને Party write બંધ છે. સંપૂર્ણ Admin snapshot હજી Admin માટે જ છે. Adminએ Partyનો સાચો email રાખીને Sync કરવો જરૂરી છે. Email બદલાય કે Party દૂર થાય ત્યારે આગળના Admin Syncથી જૂનું projection દૂર થાય છે.

Cloud Party portal હાલમાં read-only છે: પોતાનો હિસાબ, profile, સંબંધિત loan summary અને print/PDF. Loan application, message sending, guarantor directory અને data edits માટે અલગ સુરક્ષિત write APIs બનાવ્યા વગર ઉપયોગ કરવો નહીં. Portal સ્થાનિક Admin ledger સાથે merge થતું નથી અને Party modeમાં base persist બંધ છે. Sign-out પછી in-memory data દૂર કરવા પેજ reload થાય છે. Server પર revoke કર્યા પછી પહેલેથી screen પર દેખાયેલ માહિતી પાછી ખેંચી શકાતી નથી; આગળનું authenticated fetch નવી policy લાગુ કરે છે.

લાઇવ databaseમાં transaction-only isolation checks પાસ: પોતાના records, cross-Party denial, secret filtering, Admin snapshot denial, write denial, anonymous denial અને email revoke. Sample records rollback કર્યાં છે.

Email sendingની Supabase મર્યાદા અને custom SMTP configuration લાગુ રહે છે. Actual Party login માટે Admin ledger snapshot અને ઇમેલની લિંક ખોલીને user verification જરૂરી છે; આ પૂર્ણ થયા વગર real Party end-to-end test પાસ ગણવો નહીં.

