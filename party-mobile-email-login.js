/* Party login: identify by registered mobile, deliver Supabase OTP to the Party email. */
(function () {
  'use strict';
  var overlayId='aymMobileEmailOtpOverlay', state={mobile:'',email:'',config:null,resendAt:0};
  function cfg(){
    var bundled={},saved={};try{saved=JSON.parse(localStorage.getItem('aym_license_config_v1')||'{}')||{};}catch(e){}
    return fetch('./licensing-config.json',{cache:'no-store'}).then(function(r){return r.ok?r.json():{};}).catch(function(){return {};}).then(function(b){bundled=b||{};var url=String(saved.supabaseUrl||bundled.supabaseUrl||'https://ixpigzyecddpzxkedlso.supabase.co').replace(/\/+$/,'');var key=String(saved.publishableKey||bundled.publishableKey||'');if(!key)throw new Error('Supabase publishable key is not configured.');return {url:url,key:key};});
  }
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
  function remove(){var el=document.getElementById(overlayId);if(el)el.remove();}
  function shell(){
    remove();var root=document.createElement('div');root.id=overlayId;root.innerHTML='<style>#'+overlayId+'{position:fixed;inset:0;z-index:2147483000;background:#10201f99;display:grid;place-items:center;padding:16px;font:15px system-ui,sans-serif;color:#24332f}#'+overlayId+' .aym-login-card{width:min(440px,100%);max-height:90vh;overflow:auto;background:#f7faf8;border-radius:18px;padding:22px;box-shadow:0 14px 50px #0004}#'+overlayId+' h2{margin:0 0 8px}#'+overlayId+' p{line-height:1.5;color:#5b6b64}#'+overlayId+' label{display:block;font-weight:700;margin:12px 0 5px}#'+overlayId+' input{box-sizing:border-box;width:100%;padding:12px;border:1px solid #cbd8d1;border-radius:10px;background:white;font:inherit}#'+overlayId+' .aym-login-actions{display:flex;gap:9px;justify-content:flex-end;margin-top:16px}#'+overlayId+' button{border:0;border-radius:10px;padding:11px 15px;font-weight:750;cursor:pointer;background:#087f70;color:#fff}#'+overlayId+' button.aym-login-secondary{background:#e7eeea;color:#263b34}#'+overlayId+' button:disabled{opacity:.6;cursor:wait}#'+overlayId+' .aym-login-error{color:#a33131;min-height:1.4em;margin-top:8px;overflow-wrap:anywhere}</style><section class="aym-login-card" role="dialog" aria-modal="true"><h2>મોબાઇલથી પાર્ટી લોગિન</h2><p>પાર્ટી રેકોર્ડમાં નોંધાયેલ મોબાઇલ અને ઈમેલ નાખો. OTP નોંધાયેલા ઈમેલ પર આવશે.</p><div class="aym-login-fields"><label for="aymMobile">મોબાઇલ નંબર</label><input id="aymMobile" type="tel" inputmode="numeric" autocomplete="tel" placeholder="10 અંકનો નંબર"><label for="aymEmail">પાર્ટીનો નોંધાયેલ ઈમેલ</label><input id="aymEmail" type="email" autocomplete="email" placeholder="name@example.com"></div><div class="aym-login-error" aria-live="polite"></div><div class="aym-login-actions"><button type="button" class="aym-login-secondary" data-cancel>બંધ કરો</button><button type="button" data-send>ઈમેલ OTP મોકલો</button></div></section>';
    root.addEventListener('click',function(e){if(e.target===root||e.target.closest('[data-cancel]'))remove();});document.body.appendChild(root);return root;
  }
  function normMobile(v){var d=String(v||'').replace(/\D/g,'');return d.length>=10?d.slice(-10):'';}
  function normEmail(v){return String(v||'').trim().toLowerCase();}
  async function request(cfg,path,body){var r=await fetch(cfg.url+'/auth/v1/'+path,{method:'POST',headers:{apikey:cfg.key,Authorization:'Bearer '+cfg.key,'Content-Type':'application/json'},body:JSON.stringify(body)});var data=await r.json().catch(function(){return null;});if(!r.ok)throw new Error(data&&(data.msg||data.message||data.error_description)||'OTP પ્રક્રિયા નિષ્ફળ થઈ ('+r.status+').');return data||{};}
  async function send(root,button){
    var err=root.querySelector('.aym-login-error'),mobile=normMobile(root.querySelector('#aymMobile').value),email=normEmail(root.querySelector('#aymEmail').value);err.textContent='';
    if(mobile.length!==10){err.textContent='યોગ્ય 10 અંકનો મોબાઇલ નંબર નાખો.';return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){err.textContent='પાર્ટી રેકોર્ડમાં નોંધાયેલ ઈમેલ નાખો.';return;}
    state.mobile=mobile;state.email=email;button.disabled=true;button.textContent='મોકલાઈ રહ્યું છે…';
    try{state.config=await cfg();var check=await fetch(state.config.url+'/rest/v1/rpc/aym_party_mobile_email_matches',{method:'POST',headers:{apikey:state.config.key,'Content-Type':'application/json'},body:JSON.stringify({p_mobile:mobile,p_email:email})});var linked=await check.json().catch(function(){return false;});if(!check.ok||linked!==true)throw new Error('આ મોબાઇલ અને ઈમેલ Party રેકોર્ડ સાથે મેળ ખાતાં નથી. Admin પાસે વિગતો તપાસાવો.');await request(state.config,'otp',{email:email,create_user:true});state.resendAt=Date.now()+60000;showCode(root);}
    catch(e){err.textContent=e.message||'ઈમેલ OTP મોકલી શકાયો નથી.';button.disabled=false;button.textContent='ઈમેલ OTP મોકલો';}
  }
  function showCode(root){
    var fields=root.querySelector('.aym-login-fields');fields.innerHTML='<p>કોડ <b>'+esc(state.email)+'</b> પર મોકલ્યો છે. આ ઈમેલ mobile સાથે Party recordમાં નોંધાયેલ હોવો જરૂરી છે.</p><label for="aymEmailOtp">ઈમેલ OTP</label><input id="aymEmailOtp" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6 અંકનો કોડ"><button type="button" class="aym-login-secondary" data-resend style="margin-top:10px">કોડ ફરી મોકલો</button>';
    var actions=root.querySelector('.aym-login-actions');actions.querySelector('[data-send]').textContent='OTP ચકાસો';actions.querySelector('[data-send]').onclick=function(){verify(root,this);};
    fields.querySelector('[data-resend]').onclick=function(){if(Date.now()<state.resendAt)return;fields.innerHTML='<label for="aymMobile">મોબાઇલ નંબર</label><input id="aymMobile" type="tel" inputmode="numeric" value="'+esc(state.mobile)+'"><label for="aymEmail">પાર્ટીનો નોંધાયેલ ઈમેલ</label><input id="aymEmail" type="email" value="'+esc(state.email)+'">';actions.querySelector('[data-send]').textContent='ઈમેલ OTP મોકલો';actions.querySelector('[data-send]').onclick=function(){send(root,this);};send(root,actions.querySelector('[data-send]'));};
    fields.querySelector('#aymEmailOtp').focus();
  }
  async function verify(root,button){
    var err=root.querySelector('.aym-login-error'),code=String(root.querySelector('#aymEmailOtp').value||'').replace(/\D/g,'');err.textContent='';if(code.length!==6){err.textContent='6 અંકનો OTP નાખો.';return;}
    button.disabled=true;button.textContent='ચકાસાઈ રહ્યું છે…';
    try{
      var auth=await request(state.config,'verify',{email:state.email,token:code,type:'email'});
      if(!auth.access_token||!auth.refresh_token||!auth.user||!auth.user.email_confirmed_at||normEmail(auth.user.email)!==state.email)throw new Error('ઈમેલ OTP ચકાસી શકાયો નથી.');
      var records=await window.AYMPartyCloud.rows(state.config,auth),matched=records.some(function(r){var p=r&&r.data&&r.data.parties&&r.data.parties[0];return p&&normMobile(p.mobile)===state.mobile&&normEmail(r.email)===state.email;});
      if(!matched){try{await fetch(state.config.url+'/auth/v1/logout',{method:'POST',headers:{apikey:state.config.key,Authorization:'Bearer '+auth.access_token}});}catch(_){}throw new Error('આ મોબાઇલ અને ઈમેલ કોઈ Party રેકોર્ડ સાથે મેળ ખાતાં નથી. Admin પાસે બંને વિગતો અપડેટ કરાવો.');}
      localStorage.setItem('aym_phone_auth_v1',JSON.stringify({access_token:auth.access_token,refresh_token:auth.refresh_token,expires_at:Date.now()+Number(auth.expires_in||3600)*1000,user_id:auth.user.id,phone:'+91'+state.mobile,email:state.email,portal:true,supabaseUrl:state.config.url,publishableKey:state.config.key}));
      err.style.color='#087f70';err.textContent='ચકાસણી સફળ. Party ખાતું ખોલી રહ્યા છીએ…';
      if(window.AYMPO&&typeof window.AYMPO.restorePartyCloud==='function')await window.AYMPO.restorePartyCloud();
      if(window.aymPartyReadOnlyCloud){remove();return;}
      location.reload();
    }catch(e){err.style.color='';err.textContent=e.message||'લોગિન થઈ શક્યું નથી.';button.disabled=false;button.textContent='OTP ચકાસો';}
  }
  function install(){
    var api=window.AYMPO;if(!api||api.loginWithPhone&&api.loginWithPhone.__aymMobileEmail)return;
    var login=function(mobile){var root=shell();if(mobile)root.querySelector('#aymMobile').value=String(mobile).replace(/\D/g,'').slice(-10);root.querySelector('[data-send]').onclick=function(){send(root,this);};setTimeout(function(){root.querySelector('#aymMobile').focus();},30);};login.__aymMobileEmail=true;api.loginWithPhone=login;api.loginWithOtp=login;
    var link=document.getElementById('partyOtpLoginBtn');if(link)link.onclick=function(){login(document.getElementById('loginUsername')&&document.getElementById('loginUsername').value);};
  }
  install();setInterval(install,500);
})();

