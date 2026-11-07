# કોડ નોંધ — AYM Smart Ledger v1.2.81

- Supabaseને મુખ્ય cloud ledger sync તરીકે ચાલુ કર્યું; session refresh, Admin membership ચકાસણી, organization-scoped snapshot upsert અને merge-based pull/push ઉમેર્યાં.
- `aym_cloud_ledger_snapshots` માટે અલગ RLS migration ઉમેર્યું. Select/insert/update માત્ર સક્રિય Admin membershipને મળે છે.
- GitHubને વૈકલ્પિક secondary backup બનાવ્યું; Private repo તપાસે છે અને Supabase sync સફળ થયા પછી snapshot લખે છે. GitHub backup નિષ્ફળ થાય તો Supabase sync સફળ જ રહે છે અને ભૂલ log/statusમાં દેખાય છે.
- Supabase અને GitHub credentials active provider બદલતી વખતે જાળવાય છે. Join QRમાં Supabase password/session સામેલ નથી; GitHub backup ચાલુ હોય તો token સામેલ હોઈ શકે છે.
- Browser runtime અથવા Supabase project પર migration ચલાવ્યું નથી. વપરાશકર્તાએ બંને SQL migrations લાગુ કરી Admin Auth user/membership બનાવવી પડશે.
