/* Authenticated read-only Party portal. Supabase RLS chooses rows by verified email. */
(function () {
  'use strict';
  async function rows(config, auth) {
    const response = await fetch(config.url + '/rest/v1/rpc/aym_my_party_data', {
      method: 'POST', cache: 'no-store',
      headers: { apikey: config.key, Authorization: 'Bearer ' + auth.access_token, 'Content-Type': 'application/json' },
      body: '{}'
    });
    const result = await response.json().catch(() => null);
    if (!response.ok) throw new Error('Party cloud access failed (' + response.status + '). Ask the Admin to check setup.');
    if (!Array.isArray(result)) throw new Error('Invalid Party cloud response.');
    return result;
  }
  window.AYMPartyCloud = { rows };
  setTimeout(function(){
    if(!location.hash.includes('access_token=')&&window.AYMPO&&window.AYMPO.restorePartyCloud)window.AYMPO.restorePartyCloud();
  },1500);
})();
