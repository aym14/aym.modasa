/* Authenticated read-only Party portal. Supabase RLS chooses rows by verified email. */
(function () {
  'use strict';
  // The inline Party auth module calls CS() from its refresh callback, but CS
  // was declared inside a different closure. Bridge it to the app's global
  // lexical currentSession so background refresh cannot throw ReferenceError.
  if (typeof window.CS !== 'function') {
    window.CS = function () {
      try { return typeof currentSession === 'undefined' ? null : currentSession; }
      catch (e) { return null; }
    };
  }
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
  function session(){try{return window.currentSession||null;}catch(e){return null;}}
  function config(){
    var saved={};try{saved=JSON.parse(localStorage.getItem('aym_phone_auth_v1')||'{}')||{};}catch(e){}
    var url='';try{url=typeof window.supabaseBaseUrl==='function'?window.supabaseBaseUrl():'';}catch(e){}
    return {url:String(saved.supabaseUrl||url||'https://ixpigzyecddpzxkedlso.supabase.co').replace(/\/+$/,''),key:String(saved.publishableKey||'')};
  }
  async function partyToken(){
    var saved={};try{saved=JSON.parse(localStorage.getItem('aym_phone_auth_v1')||'{}')||{};}catch(e){}
    var cfg=config();if(!saved.portal||!saved.refresh_token||saved.supabaseUrl!==cfg.url||saved.publishableKey!==cfg.key)throw new Error('Party cloud session missing. Sign in again.');
    var auth={access_token:saved.access_token,refresh_token:saved.refresh_token,expires_in:Math.max(1,Math.floor(((saved.expires_at||0)-Date.now())/1000))};
    if(!saved.expires_at||saved.expires_at<Date.now()+60000){
      var tokenResponse=await fetch(cfg.url+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:saved.refresh_token})});
      auth=await tokenResponse.json().catch(function(){return null;});if(!tokenResponse.ok||!auth||!auth.access_token)throw new Error('Party cloud session expired. Sign in again.');
      saved.access_token=auth.access_token;saved.refresh_token=auth.refresh_token||saved.refresh_token;saved.expires_at=Date.now()+Number(auth.expires_in||3600)*1000;
      try{localStorage.setItem('aym_phone_auth_v1',JSON.stringify(saved));}catch(e){}
    }
    var check=await fetch(cfg.url+'/auth/v1/user',{headers:{apikey:cfg.key,Authorization:'Bearer '+auth.access_token},cache:'no-store'}),user=await check.json().catch(function(){return null;});
    var emailSession=!!(user&&user.email_confirmed_at&&String(user.email||'').trim().toLowerCase()===String(saved.email||'').trim().toLowerCase());
    var partyPasswordSession=!!(user&&user.email_confirmed_at&&user.app_metadata&&user.app_metadata.aym_party_login===true);
    if(!check.ok||!user||String(user.id||'')!==String(saved.user_id||'')||(!emailSession&&!partyPasswordSession))throw new Error('Verified Party session required. Sign in again.');
    return {cfg:cfg,auth:auth,user:user,saved:saved};
  }
  var api=window.AYMPO;
  if(api){
    if(!api.submitPartyRequest)api.submitPartyRequest=async function(subject,message){
      var current=session();if(!current||current.role!=='party'||!window.aymPartyReadOnlyCloud)throw new Error('Party cloud sign-in required.');
      var state=await partyToken(),parts=String(current.userId||current.id||'').split(':');
      if(parts.length<4||parts[0]!=='cloud')throw new Error('Party ledger identity is invalid.');
      var response=await fetch(state.cfg.url+'/rest/v1/rpc/aym_submit_party_request',{method:'POST',headers:{apikey:state.cfg.key,Authorization:'Bearer '+state.auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_organization_id:parts[1],p_sync_key:parts.slice(2,-1).join(':'),p_party_ref:parts[parts.length-1],p_subject:String(subject||''),p_message:String(message||'')})});
      var result=await response.json().catch(function(){return null;});if(!response.ok)throw new Error(result&&result.message||'Request submit failed ('+response.status+').');return result;
    };
    if(!api.submitPartyForm)api.submitPartyForm=async function(formType,payload){
      var current=session();if(!current||current.role!=='party'||!window.aymPartyReadOnlyCloud)throw new Error('Party cloud sign-in required.');
      if(['loan_application','guarantor_change'].indexOf(formType)<0)throw new Error('Invalid form type.');
      var state=await partyToken(),parts=String(current.userId||current.id||'').split(':');
      if(parts.length<4||parts[0]!=='cloud')throw new Error('Party ledger identity is invalid.');
      var response=await fetch(state.cfg.url+'/rest/v1/rpc/aym_submit_party_form',{method:'POST',headers:{apikey:state.cfg.key,Authorization:'Bearer '+state.auth.access_token,'Content-Type':'application/json'},body:JSON.stringify({p_organization_id:parts[1],p_sync_key:parts.slice(2,-1).join(':'),p_party_ref:parts[parts.length-1],p_form_type:formType,p_payload:payload})});
      var result=await response.json().catch(function(){return null;});if(!response.ok)throw new Error(result&&result.message||'Form submit failed ('+response.status+').');return result;
    };
    if(!api.listAdminPartyForms)api.listAdminPartyForms=async function(){
      if(typeof window.isAdmin!=='function'||!window.isAdmin())throw new Error('Admin sign-in required.');
      var auth=await window.supabaseEnsureAdmin(),cfg=config();
      var response=await fetch(cfg.url+'/rest/v1/aym_party_forms?select=id,organization_id,party_ref,party_name,party_email,form_type,payload,status,admin_note,created_at,updated_at&organization_id=eq.'+encodeURIComponent(auth.organizationId)+'&order=created_at.desc&limit=100',{headers:window.supabaseHeaders(),cache:'no-store'});
      var result=await response.json().catch(function(){return null;});if(!response.ok||!Array.isArray(result))throw new Error(result&&result.message||'Could not load Party forms ('+response.status+').');return result;
    };
    if(!api.updateAdminPartyForm)api.updateAdminPartyForm=async function(id,status,note){
      if(typeof window.isAdmin!=='function'||!window.isAdmin())throw new Error('Admin sign-in required.');
      if(['pending','reviewing','approved','rejected'].indexOf(status)<0)throw new Error('Invalid form status.');
      var auth=await window.supabaseEnsureAdmin(),cfg=config();
      var response=await fetch(cfg.url+'/rest/v1/aym_party_forms?id=eq.'+encodeURIComponent(id)+'&organization_id=eq.'+encodeURIComponent(auth.organizationId),{method:'PATCH',headers:Object.assign({},window.supabaseHeaders(),{Prefer:'return=minimal'}),body:JSON.stringify({status:status,admin_note:String(note||'').slice(0,2000)})});
      if(!response.ok){var result=await response.json().catch(function(){return null;});throw new Error(result&&result.message||'Could not update form ('+response.status+').');}return true;
    };
    if(!api.listAdminPartyRequests)api.listAdminPartyRequests=async function(){
      if(typeof window.isAdmin!=='function'||!window.isAdmin())throw new Error('Admin sign-in required.');
      var auth=await window.supabaseEnsureAdmin(),cfg=config();
      var response=await fetch(cfg.url+'/rest/v1/aym_party_requests?select=id,organization_id,sync_key,party_ref,party_name,party_email,subject,message,status,created_at,updated_at&organization_id=eq.'+encodeURIComponent(auth.organizationId)+'&order=created_at.desc&limit=100',{headers:window.supabaseHeaders(),cache:'no-store'});
      var result=await response.json().catch(function(){return null;});if(!response.ok||!Array.isArray(result))throw new Error(result&&result.message||'Could not load Party requests ('+response.status+').');return result;
    };
    if(!api.updateAdminPartyRequest)api.updateAdminPartyRequest=async function(id,status){
      if(typeof window.isAdmin!=='function'||!window.isAdmin())throw new Error('Admin sign-in required.');
      if(['new','reviewing','resolved'].indexOf(status)<0)throw new Error('Invalid request status.');
      var auth=await window.supabaseEnsureAdmin(),cfg=config();
      var response=await fetch(cfg.url+'/rest/v1/aym_party_requests?id=eq.'+encodeURIComponent(id)+'&organization_id=eq.'+encodeURIComponent(auth.organizationId),{method:'PATCH',headers:Object.assign({},window.supabaseHeaders(),{Prefer:'return=minimal'}),body:JSON.stringify({status:status})});
      if(!response.ok){var result=await response.json().catch(function(){return null;});throw new Error(result&&result.message||'Could not update request ('+response.status+').');}return true;
    };
  }
  function loadRequestUi(){
    if(document.querySelector('script[data-aym-party-requests]'))return;
    var script=document.createElement('script');script.src='./party-requests.js?v=invite-registration-1';script.async=true;script.dataset.aymPartyRequests='1';document.head.appendChild(script);
  }
  function loadMobileEmailLogin(){
    if(document.querySelector('script[data-aym-mobile-email-login]'))return;
    var script=document.createElement('script');script.src='./party-mobile-email-login.js';script.async=true;script.dataset.aymMobileEmailLogin='1';document.head.appendChild(script);
  }
  loadRequestUi();
  loadMobileEmailLogin();
  setTimeout(function(){
    if(!location.hash.includes('access_token=')&&window.AYMPO&&window.AYMPO.restorePartyCloud)window.AYMPO.restorePartyCloud();
  },1500);
})();
