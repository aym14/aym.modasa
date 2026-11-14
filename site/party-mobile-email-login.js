/* Party email/password login; email OTP is used only to set or reset the Party password. */
(function(){
  'use strict';
  var overlayId='aymMobileEmailOtpOverlay';
  var state={mobile:'',email:'',config:null,emailSession:null};

  function cfg(){
    var saved={};try{saved=JSON.parse(localStorage.getItem('aym_license_config_v1')||'{}')||{};}catch(_){}
    return fetch('./licensing-config.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():{};}).catch(function(){return {};}).then(function(b){
      var url=String(saved.supabaseUrl||(b||{}).supabaseUrl||'https://ixpigzyecddpzxkedlso.supabase.co').replace(/\/+$/,'');
      var key=String(saved.publishableKey||(b||{}).publishableKey||'');
      if(!key)throw new Error('Supabase publishable key is not configured.');
      return {url:url,key:key};
    });
  }
  function esc(value){return String(value||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function norm(value){var d=String(value||'').replace(/\D/g,'');return d.length>=10?d.slice(-10):'';}
  function remove(){var e=document.getElementById(overlayId);if(e)e.remove();}
  function shell(prefill){
    remove();
    var r=document.createElement('div');r.id=overlayId;
    r.innerHTML='<style>#'+overlayId+'{position:fixed;inset:0;z-index:2147483000;background:#10201f99;display:grid;place-items:center;padding:16px;font:15px system-ui,sans-serif;color:#24332f}#'+overlayId+' .card{box-sizing:border-box;width:min(440px,100%);background:#f7faf8;border-radius:18px;padding:22px;box-shadow:0 14px 50px #0004}#'+overlayId+' h2{margin:0 0 8px}#'+overlayId+' p{line-height:1.5;color:#5b6b64}#'+overlayId+' label{display:block;font-weight:700;margin:12px 0 5px}#'+overlayId+' input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #cbd8d1;border-radius:10px;background:white;font:inherit}#'+overlayId+' .actions{display:flex;gap:9px;justify-content:flex-end;margin-top:16px;flex-wrap:wrap}#'+overlayId+' button{border:0;border-radius:10px;padding:11px 15px;font-weight:750;cursor:pointer;background:#087f70;color:white;font:inherit}#'+overlayId+' button.secondary{background:#e7eeea;color:#263b34}#'+overlayId+' button.link{background:transparent;color:#087f70;text-decoration:underline;padding-inline:4px}#'+overlayId+' button:disabled{opacity:.6;cursor:wait}#'+overlayId+' .error{color:#a33131;min-height:1.4em;margin-top:8px;overflow-wrap:anywhere}#'+overlayId+' .note{font-size:13px}</style><section class="card" role="dialog" aria-modal="true"><h2>મોબાઇલથી Party Login</h2><div class="fields"><p class="note">નોંધાયેલ મોબાઇલ અને Party પાસવર્ડથી લોગિન કરો. પાસવર્ડ Admin accountથી અલગ છે.</p><label for="aymMobile">મોબાઇલ નંબર</label><input id="aymMobile" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10 અંકનો નંબર" value="'+esc(prefill)+'"><label for="aymPartyPassword">Party પાસવર્ડ</label><input id="aymPartyPassword" type="password" autocomplete="current-password" placeholder="તમારો Party પાસવર્ડ"></div><div class="error" aria-live="polite"></div><div class="actions"><button type="button" class="secondary" data-cancel>બંધ કરો</button><button type="button" class="link" data-set>પાસવર્ડ સેટ / ભૂલાયો?</button><button type="button" data-main>લોગિન કરો</button></div></section>';
    r.querySelector('h2').textContent='ઈમેલથી Party Login';
    var identityLabel=r.querySelector('label[for="aymMobile"]');identityLabel.textContent='નોંધાયેલ ઈમેલ';identityLabel.htmlFor='aymPartyEmail';
    var identity=r.querySelector('#aymMobile');identity.id='aymPartyEmail';identity.type='email';identity.inputMode='email';identity.autocomplete='username';identity.placeholder='તમારો નોંધાયેલ ઈમેલ';
    var partyPassword=r.querySelector('#aymPartyPassword');partyPassword.minLength=6;partyPassword.maxLength=128;
    r.addEventListener('click',function(e){if(e.target===r||e.target.closest('[data-cancel]'))remove();});
    document.body.appendChild(r);
    r.querySelector('[data-main]').onclick=function(){login(r,this);};
    r.querySelector('[data-set]').onclick=function(){startOtpFlow(r,'');};
    setTimeout(function(){r.querySelector('#aymPartyEmail').focus();},30);
    return r;
  }
  async function postJson(url,headers,body){
    var response=await fetch(url,{method:'POST',headers:headers,body:JSON.stringify(body)});
    var data=await response.json().catch(function(){return {};});
    if(!response.ok){var e=new Error(data.msg||data.error_description||data.message||data.error||'Request failed.');e.status=response.status;e.code=String(data.error||data.code||'');throw e;}
    return data;
  }
  async function otp(body){
    var c=state.config;
    return postJson(c.url+'/functions/v1/party-mobile-email-otp',{'apikey':c.key,'Content-Type':'application/json'},body);
  }
  function showError(root,message){root.querySelector('.error').style.color='';root.querySelector('.error').textContent=message;}
  function authLogout(c,access){if(access)fetch(c.url+'/auth/v1/logout',{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+access}}).catch(function(){});}
  function authHeaders(c){return {apikey:c.key,Authorization:'Bearer '+c.key,'Content-Type':'application/json'};}
  async function signIn(root,password){
    var c=state.config||await cfg();state.config=c;
    var result=await postJson(c.url+'/functions/v1/party-password-auth',{'apikey':c.key,'Content-Type':'application/json'},{action:'login',email:state.email,password:password});
    var auth=result.session||{},user=result.user||{};
    if(!auth.access_token||!auth.refresh_token||!user.id||!user.email_confirmed_at||!user.app_metadata||user.app_metadata.aym_party_login!==true){
      authLogout(c,auth.access_token);throw new Error('આ ઈમેલ માટે Party પાસવર્ડ ખાતું મળ્યું નથી. પહેલા ઈમેલ OTPથી પાસવર્ડ સેટ કરો.');
    }
    var response=await fetch(c.url+'/rest/v1/rpc/aym_my_party_data',{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
    var rows=await response.json().catch(function(){return null;});
    if(!response.ok||!Array.isArray(rows)){var dataError=new Error('Party data access failed.');dataError.status=response.status;dataError.code='party_data_forbidden';throw dataError;}
    var matches=[];
    rows.forEach(function(row){var parties=row&&row.data&&Array.isArray(row.data.parties)?row.data.parties:[];parties.forEach(function(p){if(p&&String(p.email||'').trim().toLowerCase()===state.email&&String(p.id||'')===String(row.party_ref||''))matches.push(row);});});
    var identities=Array.from(new Set(matches.map(function(row){return String(row.organization_id)+':'+String(row.party_ref);} )));
    if(identities.length!==1){authLogout(c,auth.access_token);var mappingError=new Error('Party record mapping failed.');mappingError.code=identities.length?'party_mobile_ambiguous':'party_record_not_synced';throw mappingError;}
    var partyMobile='';matches.forEach(function(row){(row.data&&row.data.parties||[]).forEach(function(p){if(String(p.id||'')===String(row.party_ref||''))partyMobile=norm(p.mobile);});});
    localStorage.setItem('aym_phone_auth_v1',JSON.stringify({access_token:auth.access_token,refresh_token:auth.refresh_token,expires_at:Date.now()+Number(auth.expires_in||3600)*1000,user_id:user.id,phone:partyMobile?'+91'+partyMobile:'',email:state.email,portal:true,authMode:'party_password',supabaseUrl:c.url,publishableKey:c.key}));
    root.querySelector('.error').style.color='#087f70';root.querySelector('.error').textContent='Party ખાતું ખોલી રહ્યા છીએ…';
    setTimeout(function(){location.reload();},250);
  }
  async function login(root,button){
    var email=String(root.querySelector('#aymPartyEmail').value||'').trim().toLowerCase(),password=String(root.querySelector('#aymPartyPassword').value||'');
    showError(root,'');
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showError(root,'યોગ્ય નોંધાયેલ ઈમેલ નાખો.');return;}
    if(!password){showError(root,'તમારો Party પાસવર્ડ નાખો.');return;}
    state.email=email;button.disabled=true;button.textContent='ચકાસાઈ રહ્યું છે…';
    try{await signIn(root,password);}catch(e){
      var messages={
        invalid_party_credentials:'ઈમેલ અથવા પાસવર્ડ ખોટો છે, અથવા આ Partyનો પાસવર્ડ હજી સેટ થયો નથી. “પાસવર્ડ સેટ / ભૂલાયો?”થી OTP ચકાસીને પાસવર્ડ બનાવો.',
        party_email_ambiguous:'આ ઈમેલ એકથી વધુ Party રેકોર્ડમાં છે. Adminએ duplicate Party રેકોર્ડ સુધારવા પડશે.',
        party_record_not_synced:'પાસવર્ડ સ્વીકારાયો, પણ Party રેકોર્ડ મળ્યો નથી. Adminએ Partyની વિગતો Sync કરવી પડશે.',
        party_data_forbidden:'પાસવર્ડ સ્વીકારાયો, પણ Party data access મંજૂર નથી. Adminએ Supabase Party mapping અને permissions તપાસવા પડશે.'
      };
      var message=messages[e&&e.code]||(e&&e.status===401?messages.invalid_party_credentials:(e&&e.status?'લોગિન સેવા તરફથી ભૂલ ('+e.status+') આવી. Supabase Edge Function અને Auth logs તપાસો.':'લોગિન માટે સર્વર સાથે જોડાણ ન થયું. ઇન્ટરનેટ તપાસીને ફરી પ્રયાસ કરો.'));
      showError(root,message);button.disabled=false;button.textContent='લોગિન કરો';
    }
  }
  async function sendOtp(root,button){
    var mobile=norm(root.querySelector('#aymMobile').value);showError(root,'');
    if(mobile.length!==10){showError(root,'યોગ્ય 10 અંકનો મોબાઇલ નંબર નાખો.');return;}
    state.mobile=mobile;button.disabled=true;
    try{
      state.config=state.config||await cfg();
      await otp({action:'send',mobile:mobile});
      root.querySelector('h2').textContent='ઈમેલ ચકાસો';
      root.querySelector('.fields').innerHTML='<p>નોંધાયેલા ઈમેલ પર આવેલ 8 અંકનો OTP નાખો. OTP ચકાસ્યા પછી તરત Party પાસવર્ડ બનાવવાનો વિકલ્પ આવશે.</p><label for="aymEmailOtp">ઈમેલ OTP</label><input id="aymEmailOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" pattern="[0-9]{8}" placeholder="8 અંકનો કોડ">';
      var main=root.querySelector('[data-main]');main.textContent='ઈમેલ ચકાસો';main.onclick=function(){verifyOtp(root,this);};
      var set=root.querySelector('[data-set]');set.hidden=true;button.disabled=false;root.querySelector('#aymEmailOtp').focus();
    }catch(e){
      var sendMessages={party_mobile_ambiguous:'આ મોબાઇલ એકથી વધુ Party રેકોર્ડમાં છે. Adminએ duplicate Party રેકોર્ડ સુધારવા પડશે.',party_email_not_configured:'આ Partyના રેકોર્ડમાં ઈમેલ મળ્યો નથી. Adminએ Partyનો ઈમેલ સાચવીને Sync કરવો પડશે.',otp_rate_limited:'ઘણા OTP પ્રયાસ થયા છે. થોડી વાર પછી ફરી પ્રયાસ કરો.',otp_unavailable:'ઈમેલ OTP સેવા હાલ ઉપલબ્ધ નથી. Supabase Auth અને email template તપાસો.'};
      showError(root,sendMessages[e&&e.code]||(e&&e.status?'OTP મોકલી શકાયો નથી (સેવા ભૂલ '+e.status+').':'OTP મોકલી શકાયો નથી. નોંધાયેલ mobile અને ઈમેલ તપાસો.'));button.disabled=false;
    }
  }
  async function verifyOtp(root,button){
    var token=String(root.querySelector('#aymEmailOtp').value||'').replace(/\D/g,'');showError(root,'');
    if(token.length!==8){showError(root,'8 અંકનો OTP નાખો.');return;}
    button.disabled=true;button.textContent='ચકાસાઈ રહ્યું છે…';
    try{
      var result=await otp({action:'verify',mobile:state.mobile,token:token}),session=result.session||{},user=result.user||{};
      // The OTP edge function has already bound this session to the email resolved
      // for this mobile. The password-auth endpoint independently verifies the
      // confirmed email against the bearer token before accepting a password.
      if(!session.access_token||!session.refresh_token||!user.id||!user.email)throw new Error('invalid_code');
      state.emailSession=session;state.email=String(user.email||'').trim().toLowerCase();
      root.querySelector('h2').textContent='ઈમેલ ચકાસાઈ ગયો — પાસવર્ડ બનાવો';
      root.querySelector('.fields').innerHTML='<p>હવે તમારો Party પાસવર્ડ બનાવો. આગળથી Party Loginમાં આ જ ઈમેલ અને પાસવર્ડ વાપરો. આ પાસવર્ડ Admin loginથી અલગ છે.</p><label for="aymNewPartyPassword">નવો Party પાસવર્ડ</label><input id="aymNewPartyPassword" type="password" autocomplete="new-password" minlength="6" maxlength="6" placeholder="ચોક્કસ 6 અક્ષર"><label for="aymConfirmPartyPassword">પાસવર્ડ ફરી લખો</label><input id="aymConfirmPartyPassword" type="password" autocomplete="new-password" minlength="6" maxlength="6" placeholder="પાસવર્ડની પુષ્ટિ">';
      button.disabled=false;button.textContent='Party પાસવર્ડ સેટ કરો';button.onclick=function(){setPassword(root,this);};root.querySelector('#aymNewPartyPassword').focus();
    }catch(e){
      var verifyMessages={party_mobile_ambiguous:'આ મોબાઇલ એકથી વધુ Party રેકોર્ડમાં છે. Adminએ duplicate Party રેકોર્ડ સુધારવા પડશે.',invalid_code:'OTP ખોટો છે અથવા તેની સમયમર્યાદા પૂરી થઈ છે. ફરીથી OTP મંગાવીને પ્રયાસ કરો.'};
      showError(root,verifyMessages[e&&e.code]||(e&&e.status?'ઈમેલ verification સેવા તરફથી ભૂલ ('+e.status+') આવી. Supabase Auth logs તપાસો.':'OTP verify થઈ શક્યો નથી. ફરીથી OTP મંગાવો અને પ્રયાસ કરો.'));button.disabled=false;button.textContent='ઈમેલ ચકાસો';
    }
  }
  async function setPassword(root,button){
    var password=String(root.querySelector('#aymNewPartyPassword').value||''),confirm=String(root.querySelector('#aymConfirmPartyPassword').value||'');showError(root,'');
    if(password.length!==6){showError(root,'પાસવર્ડ ચોક્કસ 6 અક્ષરનો હોવો જોઈએ.');return;}
    if(password!==confirm){showError(root,'બંને પાસવર્ડ સરખા નથી.');return;}
    button.disabled=true;button.textContent='સાચવી રહ્યા છીએ…';
    var passwordSaved=false;
    try{
      var c=state.config, result=await postJson(c.url+'/functions/v1/party-password-auth',{
        apikey:c.key,Authorization:'Bearer '+state.emailSession.access_token,'Content-Type':'application/json'
      },{action:'set_password',mobile:state.mobile,password:password});
      if(!result||result.ok!==true)throw new Error('party_password_setup_failed');
      passwordSaved=true;
      await signIn(root,password);
    }catch(e){
      var setupMessages={
        party_email_mobile_mismatch:'આ મોબાઇલ અને verified ઈમેલ એક જ synchronized Party રેકોર્ડમાં મળતા નથી. Adminએ Partyનું મોબાઇલ/ઈમેલ સાચું કરીને Sync કરવું પડશે.',
        party_mobile_ambiguous:'આ મોબાઇલ નંબર એકથી વધુ Party રેકોર્ડમાં છે. Adminએ duplicate રેકોર્ડ સુધારવા પડશે.',
        email_verification_required:'ઈમેલ ચકાસણી પૂરી થઈ નથી. નોંધાયેલા ઈમેલનો OTP ફરીથી verify કરો.'
      };
      var detail=setupMessages[e&&e.code]||(e&&e.status?'પાસવર્ડ setup સેવા તરફથી ભૂલ ('+e.status+') આવી. Supabase Edge Function logs તપાસો.':'પાસવર્ડ setup સેવા પૂર્ણ થઈ નથી. નોંધાયેલ ઈમેલ/મોબાઇલ અને ઇન્ટરનેટ તપાસીને ફરી પ્રયાસ કરો.');
      showError(root,passwordSaved?'પાસવર્ડ સાચવાયો છે, પરંતુ તરત login થયું નથી. '+detail:'Party પાસવર્ડ સેટ થઈ શક્યો નથી. '+detail);button.disabled=false;button.textContent=passwordSaved?'ફરી લોગિન કરો':'Party પાસવર્ડ સેટ કરો';if(passwordSaved)button.onclick=function(){signIn(root,password).catch(function(){showError(root,'ઈમેલ અને Party પાસવર્ડ તપાસીને ફરી લોગિન કરો.');});};
    }
  }
  function currentMobile(){var input=document.getElementById('loginUsername');return input&&input.value||'';}
  function startOtpFlow(root,prefill){
    showError(root,'');root.querySelector('h2').textContent='પાસવર્ડ સેટ / રીસેટ';
    root.querySelector('.fields').innerHTML='<p class="note">પાર્ટી રેકોર્ડમાં નોંધાયેલ મોબાઇલ નાખો. ચકાસણી કોડ તે રેકોર્ડના ઈમેલ પર મોકલાશે.</p><label for="aymMobile">નોંધાયેલ મોબાઇલ નંબર</label><input id="aymMobile" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10 અંકનો નંબર" value="'+esc(prefill||'')+'">';
    var main=root.querySelector('[data-main]');main.textContent='ઈમેલ OTP મોકલો';main.onclick=function(){sendOtp(root,this);};
    root.querySelector('[data-set]').hidden=true;setTimeout(function(){root.querySelector('#aymMobile').focus();},20);
  }
  function loginEntry(value){shell(value&&String(value).indexOf('@')>=0?value:'');}
  function setupEntry(value){var mobile=value&&String(value).indexOf('@')<0?norm(value):'',root=shell('');startOtpFlow(root,mobile);if(mobile.length===10)sendOtp(root,root.querySelector('[data-main]'));}
  window.AYMPartyPasswordLogin={open:loginEntry,setup:setupEntry};
  function install(){
    var api=window.AYMPO;if(!api)return;
    if(!api.loginWithPhone||!api.loginWithPhone.__aymSeparatePassword){
      loginEntry.__aymSeparatePassword=true;
      api.loginWithPhone=loginEntry;api.loginWithOtp=loginEntry;
    }
    var link=document.getElementById('partyOtpLoginBtn');
    if(link){link.onclick=function(){loginEntry(currentMobile());};}
    var setup=document.getElementById('loginCreatePartyLink');
    if(setup){setup.onclick=function(){setupEntry(currentMobile());};}
    if(!window.__aymPartyPasswordRestoreStarted){
      var saved={};try{saved=JSON.parse(localStorage.getItem('aym_phone_auth_v1')||'{}')||{};}catch(_){}
      if(saved.portal&&typeof api.restorePartyCloud==='function'){
        window.__aymPartyPasswordRestoreStarted=true;
        api.restorePartyCloud();
      }
    }
  }
  install();setInterval(install,500);
})();
