/* Separate Party phone/password login; email OTP is used only to set or reset the Party password. */
(function(){
  'use strict';
  var overlayId='aymMobileEmailOtpOverlay';
  var state={mobile:'',config:null,emailSession:null};

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
    r.addEventListener('click',function(e){if(e.target===r||e.target.closest('[data-cancel]'))remove();});
    document.body.appendChild(r);
    r.querySelector('[data-main]').onclick=function(){login(r,this);};
    r.querySelector('[data-set]').onclick=function(){sendOtp(r,this);};
    setTimeout(function(){r.querySelector('#aymMobile').focus();},30);
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
    var phone='+91'+state.mobile;
    var result=await postJson(c.url+'/functions/v1/party-password-auth',{'apikey':c.key,'Content-Type':'application/json'},{action:'login',mobile:state.mobile,password:password});
    var auth=result.session||{},user=result.user||{};
    if(!auth.access_token||!auth.refresh_token||!user.id||!user.email_confirmed_at||!user.app_metadata||user.app_metadata.aym_party_login!==true){
      authLogout(c,auth.access_token);throw new Error('આ mobile માટે Party પાસવર્ડ ખાતું મળ્યું નથી. પહેલા ઈમેલ OTPથી પાસવર્ડ સેટ કરો.');
    }
    var response=await fetch(c.url+'/rest/v1/rpc/aym_my_party_data',{method:'POST',headers:{apikey:c.key,Authorization:'Bearer '+auth.access_token,'Content-Type':'application/json'},body:'{}',cache:'no-store'});
    var rows=await response.json().catch(function(){return null;});
    if(!response.ok||!Array.isArray(rows)){var dataError=new Error('Party data access failed.');dataError.status=response.status;dataError.code='party_data_forbidden';throw dataError;}
    var matches=[];
    rows.forEach(function(row){var parties=row&&row.data&&Array.isArray(row.data.parties)?row.data.parties:[];parties.forEach(function(p){if(p&&norm(p.mobile)===state.mobile&&String(p.id||'')===String(row.party_ref||''))matches.push(row);});});
    var identities=Array.from(new Set(matches.map(function(row){return String(row.organization_id)+':'+String(row.party_ref);} )));
    if(identities.length!==1){authLogout(c,auth.access_token);var mappingError=new Error('Party record mapping failed.');mappingError.code=identities.length?'party_mobile_ambiguous':'party_record_not_synced';throw mappingError;}
    localStorage.setItem('aym_phone_auth_v1',JSON.stringify({access_token:auth.access_token,refresh_token:auth.refresh_token,expires_at:Date.now()+Number(auth.expires_in||3600)*1000,user_id:user.id,phone:phone,email:'',portal:true,authMode:'party_password',supabaseUrl:c.url,publishableKey:c.key}));
    root.querySelector('.error').style.color='#087f70';root.querySelector('.error').textContent='Party ખાતું ખોલી રહ્યા છીએ…';
    setTimeout(function(){location.reload();},250);
  }
  async function login(root,button){
    var mobile=norm(root.querySelector('#aymMobile').value),password=String(root.querySelector('#aymPartyPassword').value||'');
    showError(root,'');
    if(mobile.length!==10){showError(root,'યોગ્ય 10 અંકનો મોબાઇલ નંબર નાખો.');return;}
    if(!password){showError(root,'તમારો Party પાસવર્ડ નાખો.');return;}
    state.mobile=mobile;button.disabled=true;button.textContent='ચકાસાઈ રહ્યું છે…';
    try{await signIn(root,password);}catch(e){
      var messages={
        invalid_party_credentials:'મોબાઇલ અથવા પાસવર્ડ ખોટો છે, અથવા આ Partyનો પાસવર્ડ હજી સેટ થયો નથી. “પાસવર્ડ સેટ / ભૂલાયો?”થી OTP ચકાસીને પાસવર્ડ બનાવો.',
        party_mobile_ambiguous:'આ મોબાઇલ નંબર એકથી વધુ Party રેકોર્ડમાં છે. Adminએ duplicate Party રેકોર્ડ સુધારવા પડશે.',
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
      root.querySelector('.fields').innerHTML='<p>નોંધાયેલા ઈમેલ પર આવેલ 8 અંકનો OTP નાખો.</p><label for="aymEmailOtp">ઈમેલ OTP</label><input id="aymEmailOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="8" pattern="[0-9]{8}" placeholder="8 અંકનો કોડ">';
      var main=root.querySelector('[data-main]');main.textContent='ઈમેલ ચકાસો';main.onclick=function(){verifyOtp(root,this);};
      var set=root.querySelector('[data-set]');set.hidden=true;button.disabled=false;root.querySelector('#aymEmailOtp').focus();
    }catch(e){showError(root,e.status===429?'ઘણા OTP પ્રયાસ થયા છે. થોડી વાર પછી ફરી પ્રયાસ કરો.':'OTP મોકલી શકાયો નથી. નોંધાયેલ mobile અને ઈમેલ તપાસો.');button.disabled=false;}
  }
  async function verifyOtp(root,button){
    var token=String(root.querySelector('#aymEmailOtp').value||'').replace(/\D/g,'');showError(root,'');
    if(token.length!==8){showError(root,'8 અંકનો OTP નાખો.');return;}
    button.disabled=true;button.textContent='ચકાસાઈ રહ્યું છે…';
    try{
      var result=await otp({action:'verify',mobile:state.mobile,token:token}),session=result.session||{},user=result.user||{};
      if(!session.access_token||!session.refresh_token||!user.id||!user.email||!user.email_confirmed_at)throw new Error('invalid_code');
      state.emailSession=session;
      root.querySelector('.fields').innerHTML='<p>ઈમેલ ચકાસાઈ ગયો. આ પાસવર્ડ ફક્ત Party login માટે રહેશે.</p><label for="aymNewPartyPassword">નવો Party પાસવર્ડ</label><input id="aymNewPartyPassword" type="password" autocomplete="new-password" minlength="10" placeholder="ઓછામાં ઓછા 10 અક્ષર"><label for="aymConfirmPartyPassword">પાસવર્ડ ફરી લખો</label><input id="aymConfirmPartyPassword" type="password" autocomplete="new-password" minlength="10" placeholder="પાસવર્ડની પુષ્ટિ">';
      button.disabled=false;button.textContent='Party પાસવર્ડ સેટ કરો';button.onclick=function(){setPassword(root,this);};root.querySelector('#aymNewPartyPassword').focus();
    }catch(_){showError(root,'OTP ખોટો છે અથવા તેની સમયમર્યાદા પૂરી થઈ છે. નવો OTP મંગાવો.');button.disabled=false;button.textContent='ઈમેલ ચકાસો';}
  }
  async function setPassword(root,button){
    var password=String(root.querySelector('#aymNewPartyPassword').value||''),confirm=String(root.querySelector('#aymConfirmPartyPassword').value||'');showError(root,'');
    if(password.length<10||password.length>128){showError(root,'પાસવર્ડ 10થી 128 અક્ષરનો હોવો જોઈએ.');return;}
    if(password!==confirm){showError(root,'બંને પાસવર્ડ સરખા નથી.');return;}
    button.disabled=true;button.textContent='સાચવી રહ્યા છીએ…';
    var passwordSaved=false;
    try{
      var c=state.config, response=await postJson(c.url+'/functions/v1/party-password-auth',{
        apikey:c.key,Authorization:'Bearer '+state.emailSession.access_token,'Content-Type':'application/json'
      },{action:'set_password',mobile:state.mobile,password:password});
      if(!response.ok)throw new Error('party_password_setup_failed');
      passwordSaved=true;
      await signIn(root,password);
    }catch(e){
      var setupMessages={
        party_email_mobile_mismatch:'આ મોબાઇલ અને verified ઈમેલ એક જ synchronized Party રેકોર્ડમાં મળતા નથી. Adminએ Partyનું મોબાઇલ/ઈમેલ સાચું કરીને Sync કરવું પડશે.',
        party_mobile_ambiguous:'આ મોબાઇલ નંબર એકથી વધુ Party રેકોર્ડમાં છે. Adminએ duplicate રેકોર્ડ સુધારવા પડશે.',
        email_verification_required:'ઈમેલ ચકાસણી પૂરી થઈ નથી. નોંધાયેલા ઈમેલનો OTP ફરીથી verify કરો.'
      };
      var detail=setupMessages[e&&e.code]||(e&&e.status?'પાસવર્ડ setup સેવા તરફથી ભૂલ ('+e.status+') આવી. Supabase Edge Function logs તપાસો.':'નોંધાયેલ ઈમેલ/મોબાઇલ તપાસો અને ઇન્ટરનેટ જોડાણ સાથે ફરી પ્રયાસ કરો.');
      showError(root,passwordSaved?'પાસવર્ડ સાચવાયો છે, પરંતુ તરત login થયું નથી. '+detail:'Party પાસવર્ડ સેટ થઈ શક્યો નથી. '+detail);button.disabled=false;button.textContent=passwordSaved?'ફરી લોગિન કરો':'Party પાસવર્ડ સેટ કરો';if(passwordSaved)button.onclick=function(){signIn(root,password).catch(function(){showError(root,'મોબાઇલ અને Party પાસવર્ડ તપાસીને ફરી લોગિન કરો.');});};
    }
  }
  function currentMobile(){var input=document.getElementById('loginUsername');return input&&input.value||'';}
  function loginEntry(mobile){shell(mobile||'');}
  function setupEntry(mobile){var root=shell(mobile||'');sendOtp(root,root.querySelector('[data-set]'));}
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
