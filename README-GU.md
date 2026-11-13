# AYM Smart Ledger v1.2.84

Settings → Cloud Syncમાં Supabase મુખ્ય ledger provider છે. Admin email પર OTP મંગાવી તે ચકાસ્યા પછી જ સક્રિય organization Adminને access મળે છે. Party login/OTP તેની અલગ પ્રક્રિયા છે. અન્ય trusted Admin devices માટે દરેક device પર Supabase Auth sign-in જરૂરી છે.

Manual Pull cloud અને local records merge કરે છે. Network/permissionથી cloud read નિષ્ફળ જાય તો તેને ખાલી cloud માનાતો નથી; concurrent ફેરફારો ત્રણ પ્રયાસમાં સરખા ન થાય તો sync error બતાવે છે.

સફળ Supabase Sync પછી optional GitHub checkboxથી snapshot એક અલગ Private Repositoryમાં backup થાય છે. Token આ browserમાં રાખવામાં આવે છે; Join QRમાં તે સામેલ થઈ શકે છે. QR ફક્ત વિશ્વાસપાત્ર Admin deviceને આપો.

સ્થાનિક JSON backup/restore Settings → Backup and restoreમાં છે. Restore target deviceનો હાલનો ડેટા બદલે છે.

Setup અને migration માટે package rootમાં `supabase/README-GU.md` જુઓ.

## GitHub Pages ફાઇલો

`index.html`, `manifest.json`, `sw.js`, `icons/` અને `licensing-config.json`ને Pagesના rootમાં રાખો.
